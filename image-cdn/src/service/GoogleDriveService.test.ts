import { describe, expect, it, vi } from "vitest";

import { GoogleDriveService } from "./GoogleDriveService";

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

  it("omits entries with unrecognised status codes", () => {
    const response = `--boundary
Content-Type: application/http
Content-ID: <response-forbiddenFileId>

HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=UTF-8

{}

--boundary--`;

    const result = GoogleDriveService.parseBatchModifiedTimesResponse(response, "boundary");

    expect(result.size).toBe(0);
  });

  it("returns an empty map for an empty response body", () => {
    const result = GoogleDriveService.parseBatchModifiedTimesResponse("--boundary--", "boundary");
    expect(result.size).toBe(0);
  });
});

describe("GoogleDriveService.getBatchModifiedTimes", () => {
  it("calls getModifiedTimes 10 times for 1000 identifiers", async () => {
    const service = new GoogleDriveService();
    service.accessToken = "fake-token";
    const spy = vi.spyOn(service, "getModifiedTimes").mockResolvedValue(new Map());

    const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
    await service.getBatchModifiedTimes(ids);

    expect(spy).toHaveBeenCalledTimes(10);
    expect(spy.mock.calls[0][0]).toEqual(ids.slice(0, 100));
    expect(spy.mock.calls[9][0]).toEqual(ids.slice(900, 1000));
  });

  it("merges results from all batches into a single map", async () => {
    const service = new GoogleDriveService();
    service.accessToken = "fake-token";
    vi.spyOn(service, "getModifiedTimes").mockImplementation(async (ids) => new Map(ids.map((id) => [id, new Date("2024-01-01")])));

    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const result = await service.getBatchModifiedTimes(ids);

    expect(result.size).toBe(250);
    expect(result.get("id-0")).toEqual(new Date("2024-01-01"));
    expect(result.get("id-249")).toEqual(new Date("2024-01-01"));
  });

  it("uses a single call to getModifiedTimes for fewer than 100 identifiers", async () => {
    const service = new GoogleDriveService();
    service.accessToken = "fake-token";
    const spy = vi.spyOn(service, "getModifiedTimes").mockResolvedValue(new Map());

    await service.getBatchModifiedTimes(["a", "b", "c"]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("returns an empty map and makes no calls for empty identifiers", async () => {
    const service = new GoogleDriveService();
    service.accessToken = "fake-token";
    const spy = vi.spyOn(service, "getModifiedTimes").mockResolvedValue(new Map());

    const result = await service.getBatchModifiedTimes([]);

    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
