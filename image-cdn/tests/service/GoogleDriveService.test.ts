import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleDriveService } from "../../src/service/GoogleDriveService";

const BOUNDARY = "batch_QLw9FXX2XXKO0wwoBWtbfpZxugBfnGo-";

const REAL_API_RESPONSE = `--batch_QLw9FXX2XXKO0wwoBWtbfpZxugBfnGo-
Content-Type: application/http
Content-ID: <response-1RQ4R_gB6onSkCB74JBZ64NjGHXL8i6jz>

HTTP/1.1 200 OK
Date: Sat, 13 Jun 2026 06:01:44 GMT
Cache-Control: private, max-age=0
Expires: Sat, 13 Jun 2026 06:01:44 GMT
Content-Type: application/json; charset=UTF-8
Content-Length: 49

{
  "modifiedTime": "2026-05-11T01:11:07.000Z"
}

--batch_QLw9FXX2XXKO0wwoBWtbfpZxugBfnGo-
Content-Type: application/http
Content-ID: <response-1W5GVWDG5s7IQOgZ1k-yj4AnQzRB6z_oW>

HTTP/1.1 200 OK
Expires: Sat, 13 Jun 2026 06:01:44 GMT
Date: Sat, 13 Jun 2026 06:01:44 GMT
Cache-Control: private, max-age=0
Content-Type: application/json; charset=UTF-8
Content-Length: 49

{
  "modifiedTime": "2020-07-28T17:55:32.000Z"
}

--batch_QLw9FXX2XXKO0wwoBWtbfpZxugBfnGo-
Content-Type: application/http
Content-ID: <response-1bU8hksCsdkS4U_Gc9dkTix8iKMbCdsqN>

HTTP/1.1 200 OK
Expires: Sat, 13 Jun 2026 06:01:44 GMT
Date: Sat, 13 Jun 2026 06:01:44 GMT
Cache-Control: private, max-age=0
Content-Type: application/json; charset=UTF-8
Content-Length: 49

{
  "modifiedTime": "2022-06-29T05:34:49.496Z"
}

--batch_QLw9FXX2XXKO0wwoBWtbfpZxugBfnGo---`;

const createEnv = (overrides: Partial<Env> = {}) =>
  ({
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_REFRESH_TOKEN: "refresh-token",
    GOOGLE_DRIVE_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true })),
    },
    ...overrides,
  } as unknown as Env);

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GoogleDriveService.parseBatchModifiedTimesResponse", () => {
  it("parses modifiedTime for all three entries from a real API response", () => {
    const result = GoogleDriveService.parseBatchModifiedTimesResponse(REAL_API_RESPONSE, BOUNDARY);

    expect(result.size).toBe(3);
    expect(result.get("1RQ4R_gB6onSkCB74JBZ64NjGHXL8i6jz")).toEqual(new Date("2026-05-11T01:11:07.000Z"));
    expect(result.get("1W5GVWDG5s7IQOgZ1k-yj4AnQzRB6z_oW")).toEqual(new Date("2020-07-28T17:55:32.000Z"));
    expect(result.get("1bU8hksCsdkS4U_Gc9dkTix8iKMbCdsqN")).toEqual(new Date("2022-06-29T05:34:49.496Z"));
  });

  it("returns null for 404 entries", () => {
    const response = `--boundary
Content-Type: application/http
Content-ID: <response-missingFileId>

HTTP/1.1 404 Not Found
Content-Type: application/json; charset=UTF-8

{
  "error": { "code": 404, "message": "File not found." }
}

--boundary--`;

    const result = GoogleDriveService.parseBatchModifiedTimesResponse(response, "boundary");

    expect(result.size).toBe(1);
    expect(result.get("missingFileId")).toBeNull();
  });

  it("throws a non-retryable error for 403 entries", () => {
    const response = `--boundary
Content-Type: application/http
Content-ID: <response-forbiddenFileId>

HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=UTF-8

{}

--boundary--`;

    expect(() => GoogleDriveService.parseBatchModifiedTimesResponse(response, "boundary")).toThrow("Exceeded Google Drive rate limit");
  });

  it("returns an empty map for an empty response body", () => {
    const result = GoogleDriveService.parseBatchModifiedTimesResponse("--boundary--", "boundary");
    expect(result.size).toBe(0);
  });
});

describe("GoogleDriveService.getBatchModifiedTimes", () => {
  it("calls getModifiedTimes 10 times for 1000 identifiers", async () => {
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "fake-token";
    const spy = vi.spyOn(service, "getModifiedTimes").mockResolvedValue(new Map());

    const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
    await service.getBatchModifiedTimes(ids);

    expect(spy).toHaveBeenCalledTimes(10);
    expect(spy.mock.calls[0][0]).toEqual(ids.slice(0, 100));
    expect(spy.mock.calls[9][0]).toEqual(ids.slice(900, 1000));
  });

  it("merges results from all batches into a single map", async () => {
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "fake-token";
    vi.spyOn(service, "getModifiedTimes").mockImplementation(async (ids) => new Map(ids.map((id) => [id, new Date("2024-01-01")])));

    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const result = await service.getBatchModifiedTimes(ids);

    expect(result.size).toBe(250);
    expect(result.get("id-0")).toEqual(new Date("2024-01-01"));
    expect(result.get("id-249")).toEqual(new Date("2024-01-01"));
  });

  it("uses a single call to getModifiedTimes for fewer than 100 identifiers", async () => {
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "fake-token";
    const spy = vi.spyOn(service, "getModifiedTimes").mockResolvedValue(new Map());

    await service.getBatchModifiedTimes(["a", "b", "c"]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("returns an empty map and makes no calls for empty identifiers", async () => {
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "fake-token";
    const spy = vi.spyOn(service, "getModifiedTimes").mockResolvedValue(new Map());

    const result = await service.getBatchModifiedTimes([]);

    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("GoogleDriveService.executeCall", () => {
  it("requires an access token for authenticated calls", async () => {
    const service = new GoogleDriveService(createEnv());

    await expect(service.executeCall("https://example.com", "", true)).rejects.toThrow(
      "Attempted to execute authenticated Google Drive API call but accessToken is undefined"
    );
  });

  it("sends authenticated multipart POST requests when rate limiting allows the call", async () => {
    const body = "batch-body";
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "access-token";

    await service.executeCall("https://www.googleapis.com/batch/drive/v3", body, true, "batch_boundary");

    expect(fetchMock).toHaveBeenCalledWith("https://www.googleapis.com/batch/drive/v3", {
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "multipart/mixed; boundary=batch_boundary",
      },
      method: "POST",
      body,
    });
  });

  it("backs off when the Cloudflare rate limiter denies an attempt", async () => {
    const limit = vi.fn().mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const service = new GoogleDriveService(createEnv({ GOOGLE_DRIVE_RATE_LIMITER: { limit } as unknown as RateLimit }));
    const delay = vi.spyOn(service, "delay").mockResolvedValue(undefined);

    await service.executeCall("https://example.com", "body", false);

    expect(delay).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries Google Drive 429 responses before returning a successful response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("too many", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const service = new GoogleDriveService(createEnv());
    const delay = vi.spyOn(service, "delay").mockResolvedValue(undefined);

    const response = await service.executeCall("https://example.com", "body", false);

    expect(await response.text()).toBe("ok");
    expect(delay).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after every attempt is rate limited", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const service = new GoogleDriveService(createEnv({ GOOGLE_DRIVE_RATE_LIMITER: { limit } as unknown as RateLimit }));
    vi.spyOn(service, "delay").mockResolvedValue(undefined);

    await expect(service.executeCall("https://example.com", "body", false)).rejects.toThrow(
      "Google Drive API error: 429 Too Many Requests"
    );
    expect(limit).toHaveBeenCalledTimes(6);
  });
});

describe("GoogleDriveService.refreshAccessToken", () => {
  it("fails with non-retryable configuration errors when required secrets are missing", async () => {
    const service = new GoogleDriveService(createEnv());

    await expect(service.refreshAccessToken(createEnv({ GOOGLE_CLIENT_ID: "" }))).rejects.toThrow("GOOGLE_CLIENT_ID not defined!");
    await expect(service.refreshAccessToken(createEnv({ GOOGLE_CLIENT_SECRET: "" }))).rejects.toThrow("GOOGLE_CLIENT_SECRET not defined!");
    await expect(service.refreshAccessToken(createEnv({ GOOGLE_REFRESH_TOKEN: "" }))).rejects.toThrow("GOOGLE_REFRESH_TOKEN not defined!");
  });

  it("sets the access token from Google's token response and does not refresh twice", async () => {
    const service = new GoogleDriveService(createEnv());
    const executeCall = vi.spyOn(service, "executeCall").mockResolvedValue(new Response(JSON.stringify({ access_token: "new-token" })));

    await service.refreshAccessToken(createEnv());
    await service.refreshAccessToken(createEnv());

    expect(service.accessToken).toBe("new-token");
    expect(executeCall).toHaveBeenCalledTimes(1);
    const tokenBody = executeCall.mock.calls[0][1] as URLSearchParams;
    expect(tokenBody.get("client_id")).toBe("client-id");
    expect(tokenBody.get("client_secret")).toBe("client-secret");
    expect(tokenBody.get("refresh_token")).toBe("refresh-token");
    expect(tokenBody.get("grant_type")).toBe("refresh_token");
  });
});

describe("GoogleDriveService.getModifiedTimes", () => {
  it("builds an authenticated batch request and parses the response boundary", async () => {
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "access-token";
    const executeCall = vi.spyOn(service, "executeCall").mockResolvedValue(
      new Response(
        `--response_boundary
Content-Type: application/http
Content-ID: <response-a/b>

HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{"modifiedTime":"2024-05-01T00:00:00.000Z"}

--response_boundary--`,
        { headers: { "Content-Type": "text/plain; boundary=response_boundary" } }
      )
    );

    const result = await service.getModifiedTimes(["a/b"]);

    expect(result.get("a/b")).toEqual(new Date("2024-05-01T00:00:00.000Z"));
    expect(executeCall).toHaveBeenCalledTimes(1);
    expect(executeCall.mock.calls[0][0]).toBe("https://www.googleapis.com/batch/drive/v3");
    expect(executeCall.mock.calls[0][2]).toBe(true);
    expect(executeCall.mock.calls[0][3]).toMatch(/^batch_/);
    expect(executeCall.mock.calls[0][1]).toContain("Content-ID: <a/b>");
    expect(executeCall.mock.calls[0][1]).toContain("GET /drive/v3/files/a%2Fb?fields=modifiedTime");
  });

  it("throws when the batch response content type does not include a boundary", async () => {
    const service = new GoogleDriveService(createEnv());
    service.accessToken = "access-token";
    vi.spyOn(service, "executeCall").mockResolvedValue(new Response("", { headers: { "Content-Type": "text/plain" } }));

    await expect(service.getModifiedTimes(["id"])).rejects.toThrow("Could not parse batch response boundary from: text/plain");
  });
});
