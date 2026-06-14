import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import worker from "../../src/";
import { R2Service } from "../../src/service/R2Service";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const SMALL_IMAGE_KEY = R2Service.getImageKey("google_drive", "small", "image-id");
const LARGE_IMAGE_KEY = R2Service.getImageKey("google_drive", "large", "image-id");

const readBody = async (body: Pick<Body, "arrayBuffer">) => new TextDecoder().decode(await body.arrayBuffer());

const fetchWorker = async (url: string, init?: RequestInit<IncomingRequestCfProperties>) => {
  const request = new IncomingRequest(url, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
};

describe("worker image routing", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await env.thumbnails.delete(SMALL_IMAGE_KEY);
    await env.thumbnails.delete(LARGE_IMAGE_KEY);
  });

  it("responds with not found for unknown endpoints", async () => {
    const response = await fetchWorker("http://example.com/404");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Unknown endpoint.");
  });

  it("rejects unsupported methods for image routes", async () => {
    const response = await fetchWorker("http://example.com/images/google_drive/small/image-id.jpg", { method: "POST" });

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Unsupported HTTP method.");
  });

  it("handles CORS preflight requests for image routes", async () => {
    const response = await fetchWorker("http://example.com/images/google_drive/small/image-id.jpg", {
      method: "OPTIONS",
      headers: {
        Origin: "https://mpcfill.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "X-Test-Header",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("X-Test-Header");
  });

  it("returns a bad request for malformed image URLs", async () => {
    const response = await fetchWorker("http://example.com/images/google_drive/medium/image-id.jpg");

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Malformed URL.");
  });

  it("proxies small thumbnails on cache misses and stores them in R2", async () => {
    const fetchMock = vi.fn(async () => new Response("fresh-small", { headers: { "content-length": "11" } }));
    vi.stubGlobal("fetch", fetchMock);
    const ctx = createExecutionContext();

    const response = await worker.fetch(
      new IncomingRequest("http://example.com/images/google_drive/small/image-id.jpg?jpgQuality=80"),
      env,
      ctx
    );

    expect(await response.text()).toBe("fresh-small");
    expect(fetchMock).toHaveBeenCalledWith("https://lh4.googleusercontent.com/d/image-id=h400-rj-l80");

    await waitOnExecutionContext(ctx);
    const cached = await env.thumbnails.get(SMALL_IMAGE_KEY);
    expect(cached ? await readBody(cached) : undefined).toBe("fresh-small");
  });

  it("serves cached thumbnails from R2 without fetching the source URL", async () => {
    await env.thumbnails.put(SMALL_IMAGE_KEY, "cached-small", { httpMetadata: { contentType: "image/jpg" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWorker("http://example.com/images/google_drive/small/image-id.jpg");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await readBody(response)).toBe("cached-small");
    expect(response.headers.get("content-type")).toBe("image/jpg");
  });

  it("fetches full-size images directly with dpi and quality parameters", async () => {
    const fetchMock = vi.fn(async () => new Response("full-image"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWorker("http://example.com/images/google_drive/full/image-id.jpg?dpi=600&jpgQuality=95");

    expect(await response.text()).toBe("full-image");
    expect(fetchMock).toHaveBeenCalledWith("https://lh4.googleusercontent.com/d/image-id=h2220-rj-l95");
  });

  it("throws for invalid dpi or JPG quality query parameters", async () => {
    await expect(fetchWorker("http://example.com/images/google_drive/full/image-id.jpg?dpi=0")).rejects.toThrow("invalid DPI 0");
    await expect(fetchWorker("http://example.com/images/google_drive/full/image-id.jpg?jpgQuality=101")).rejects.toThrow(
      "invalid JPG quality 101"
    );
  });
});
