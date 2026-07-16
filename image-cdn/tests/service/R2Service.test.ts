import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { R2Service } from "../../src/service/R2Service";

const IMAGE_URL = "https://lh4.googleusercontent.com/d/image-id=h400";
const IMAGE_KEY = R2Service.getImageKey("google_drive", "small", "image-id");

const fetchedImageResponse = (body: string) =>
  new Response(body, {
    headers: {
      "content-length": String(body.length),
      "content-type": "image/png",
    },
  });

const putCachedImage = async (key: string, body: string) => {
  await env.thumbnails.put(key, body, {
    httpMetadata: {
      contentType: "image/jpg",
    },
  });
};

const readBody = async (body: Pick<Body, "arrayBuffer">) => new TextDecoder().decode(await body.arrayBuffer());

describe("R2Service", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await env.thumbnails.delete(IMAGE_KEY);
  });

  it("builds image keys from identifier, size, and type", () => {
    expect(R2Service.getImageKey("google_drive", "large", "abc123")).toBe("abc123-large-google_drive");
  });

  it("stores fetched images in the thumbnails R2 bucket", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fetchedImageResponse("fresh-image"))
    );

    await R2Service.putImage(env, IMAGE_URL, IMAGE_KEY);

    const object = await env.thumbnails.get(IMAGE_KEY);
    expect(object).not.toBeNull();
    expect(object ? await readBody(object) : undefined).toBe("fresh-image");

    const headers = new Headers();
    object?.writeHttpMetadata(headers);
    expect(headers.get("content-type")).toBe("image/jpg");
  });

  it("does not overwrite an existing thumbnail unless resync is requested", async () => {
    await putCachedImage(IMAGE_KEY, "cached-image");
    const fetchMock = vi.fn(async () => fetchedImageResponse("replacement-image"));
    vi.stubGlobal("fetch", fetchMock);

    await R2Service.putImage(env, IMAGE_URL, IMAGE_KEY);

    expect(fetchMock).not.toHaveBeenCalled();
    const object = await env.thumbnails.get(IMAGE_KEY);
    expect(object ? await readBody(object) : undefined).toBe("cached-image");
  });

  it("replaces an existing thumbnail during resync", async () => {
    await putCachedImage(IMAGE_KEY, "cached-image");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fetchedImageResponse("replacement-image"))
    );

    await R2Service.putImage(env, IMAGE_URL, IMAGE_KEY, true);

    const object = await env.thumbnails.get(IMAGE_KEY);
    expect(object ? await readBody(object) : undefined).toBe("replacement-image");
  });

  it("returns cached thumbnail data without fetching from the source URL", async () => {
    await putCachedImage(IMAGE_KEY, "cached-image");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ctx = createExecutionContext();

    const response = await R2Service.getThumbnail(env, ctx, IMAGE_URL, IMAGE_KEY);
    await waitOnExecutionContext(ctx);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await readBody(response)).toBe("cached-image");
    expect(response.headers.get("content-type")).toBe("image/jpg");
  });

  it("proxies cache misses and caches the image in the background", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fetchedImageResponse("fresh-image"))
    );
    const ctx = createExecutionContext();

    const response = await R2Service.getThumbnail(env, ctx, IMAGE_URL, IMAGE_KEY);
    expect(await readBody(response)).toBe("fresh-image");

    await waitOnExecutionContext(ctx);
    const object = await env.thumbnails.get(IMAGE_KEY);
    expect(object ? await readBody(object) : undefined).toBe("fresh-image");
  });

  it("does not cache unsuccessful image fetches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404, headers: { "content-length": "9" } }))
    );

    await R2Service.putImage(env, IMAGE_URL, IMAGE_KEY);

    expect(await env.thumbnails.get(IMAGE_KEY)).toBeNull();
  });
});
