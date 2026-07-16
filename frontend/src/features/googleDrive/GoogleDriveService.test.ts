import { GoogleDriveService } from "@/features/googleDrive/GoogleDriveService";

const noDelay = () => Promise.resolve();

function makeResponse(
  status: number,
  body: object,
  headers: Record<string, string> = {}
): Response {
  return {
    status,
    statusText: status === 429 ? "Too Many Requests" : "OK",
    ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key] ?? null } as any,
    json: () => Promise.resolve(body),
  } as Response;
}

function makeDeferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const tick = () => Promise.resolve();
// Yields past the full microtask queue (including chained promise resolutions)
// by deferring to a macrotask, which only runs after all pending microtasks drain.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("GoogleDriveService.executeCall", () => {
  let delayFn: jest.Mock;
  let service: GoogleDriveService;

  beforeEach(() => {
    delayFn = jest.fn().mockResolvedValue(undefined);
    service = new GoogleDriveService("test-token", delayFn);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("successful response: returns parsed JSON", async () => {
    const body = { files: [{ id: "1", name: "folder" }] };
    jest.spyOn(global, "fetch").mockResolvedValue(makeResponse(200, body));

    const result = await service.executeCall("files", new URLSearchParams());

    expect(result).toEqual(body);
  });

  test("Authorization header uses bearer token", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(makeResponse(200, {}));

    await service.executeCall("files", new URLSearchParams());

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      })
    );
  });

  describe("error handling", () => {
    test("non-429 error response: throws immediately without retrying", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(makeResponse(403, {}));

      await expect(
        service.executeCall("files", new URLSearchParams())
      ).rejects.toThrow("Google Drive API error: 403");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(delayFn).not.toHaveBeenCalled();
    });
  });

  describe("retry with backoff", () => {
    test("429 then success: retries and returns result", async () => {
      const body = { files: [] };
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(makeResponse(429, {}))
        .mockResolvedValueOnce(makeResponse(200, body));

      const result = await service.executeCall("files", new URLSearchParams());

      expect(result).toEqual(body);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    test("429 exhausts all retries: throws after MAX_RETRIES+1 attempts", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(makeResponse(429, {}));

      await expect(
        service.executeCall("files", new URLSearchParams())
      ).rejects.toThrow("Google Drive API error: 429");
      expect(fetchSpy).toHaveBeenCalledTimes(5); // initial + 4 retries
      expect(delayFn).toHaveBeenCalledTimes(4);
    });

    test("Retry-After header: uses header value instead of default delay", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(makeResponse(429, {}, { "Retry-After": "10" }))
        .mockResolvedValueOnce(makeResponse(200, {}));

      await service.executeCall("files", new URLSearchParams());

      expect(delayFn).toHaveBeenCalledWith(10_000);
    });

    test("no Retry-After header: uses exponential backoff starting at 1s", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(makeResponse(429, {}))
        .mockResolvedValueOnce(makeResponse(429, {}))
        .mockResolvedValueOnce(makeResponse(200, {}));

      await service.executeCall("files", new URLSearchParams());

      expect(delayFn).toHaveBeenNthCalledWith(1, 1000);
      expect(delayFn).toHaveBeenNthCalledWith(2, 2000);
    });
  });

  describe("concurrency limiting", () => {
    const CONCURRENCY = 2;
    let concurrentService: GoogleDriveService;

    beforeEach(() => {
      concurrentService = new GoogleDriveService(
        "test-token",
        noDelay,
        CONCURRENCY
      );
    });

    test("requests beyond the concurrency limit are queued", async () => {
      const deferreds = [makeDeferred(), makeDeferred(), makeDeferred()];
      let call = 0;
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockImplementation(() => deferreds[call++].promise);

      concurrentService.executeCall("files", new URLSearchParams());
      concurrentService.executeCall("files", new URLSearchParams());
      concurrentService.executeCall("files", new URLSearchParams());

      await tick(); // let the first CONCURRENCY requests acquire and call fetch

      expect(fetchSpy).toHaveBeenCalledTimes(CONCURRENCY);
    });

    test("queued request starts as soon as a slot frees", async () => {
      const deferreds = [makeDeferred(), makeDeferred(), makeDeferred()];
      let call = 0;
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockImplementation(() => deferreds[call++].promise);

      concurrentService.executeCall("files", new URLSearchParams());
      concurrentService.executeCall("files", new URLSearchParams());
      concurrentService.executeCall("files", new URLSearchParams());

      await tick();
      expect(fetchSpy).toHaveBeenCalledTimes(CONCURRENCY);

      deferreds[0].resolve(makeResponse(200, {}));
      await flush(); // drain the full resolve → finally → release → acquire → fetch chain

      expect(fetchSpy).toHaveBeenCalledTimes(CONCURRENCY + 1);
    });

    test("all requests complete without deadlock", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(makeResponse(200, { files: [] }));

      const results = await Promise.all([
        concurrentService.executeCall("files", new URLSearchParams()),
        concurrentService.executeCall("files", new URLSearchParams()),
        concurrentService.executeCall("files", new URLSearchParams()),
        concurrentService.executeCall("files", new URLSearchParams()),
      ]);

      expect(results).toHaveLength(4);
      results.forEach((r) => expect(r).toEqual({ files: [] }));
    });
  });
});
