import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { R2Service } from "../../src/service/R2Service";
import { ThumbnailRefreshWorkflow } from "../../src/workflow/ThumbnailRefreshWorkflow";

const IDENTIFIER = "workflow-image";
const SMALL_KEY = R2Service.getImageKey("google_drive", "small", IDENTIFIER);
const LARGE_KEY = R2Service.getImageKey("google_drive", "large", IDENTIFIER);
const IRRELEVANT_KEY = "workflow-image-full-google_drive";

const readBody = async (body: Pick<Body, "arrayBuffer">) => new TextDecoder().decode(await body.arrayBuffer());

const createWorkflow = () => {
  const workflow = Object.create(ThumbnailRefreshWorkflow.prototype) as ThumbnailRefreshWorkflow & { env: Env };
  workflow.env = env;
  return workflow;
};

const createWorkflowWithEnv = (workflowEnv: Env) => {
  const workflow = Object.create(ThumbnailRefreshWorkflow.prototype) as ThumbnailRefreshWorkflow & { env: Env };
  workflow.env = workflowEnv;
  return workflow;
};

const putThumbnail = async (key: string, body: string) => {
  await env.thumbnails.put(key, body, { httpMetadata: { contentType: "image/jpg" } });
  const object = await env.thumbnails.head(key);
  if (object === null) {
    throw new Error(`Expected ${key} to exist`);
  }
  return object;
};

const createBatchModifiedTimesResponse = (body: BodyInit | null | undefined) => {
  const requestBody = String(body);
  const requestedIds = [...requestBody.matchAll(/Content-ID: <([^>]+)>/g)].map((match) => match[1]);
  const boundary = "response_boundary";
  const parts = requestedIds.map(
    (id) =>
      `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <response-${id}>\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"modifiedTime":"2020-01-01T00:00:00.000Z"}`
  );
  return new Response(`${parts.join("\r\n")}\r\n--${boundary}--`, {
    headers: { "Content-Type": `multipart/mixed; boundary=${boundary}` },
  });
};

describe("ThumbnailRefreshWorkflow", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await env.thumbnails.delete(SMALL_KEY);
    await env.thumbnails.delete(LARGE_KEY);
    await env.thumbnails.delete(IRRELEVANT_KEY);
  });

  it("deletes both cached thumbnail sizes when Google Drive reports the source image is missing", async () => {
    const object = await putThumbnail(SMALL_KEY, "small-thumbnail");
    await putThumbnail(LARGE_KEY, "large-thumbnail");

    const refreshed = await createWorkflow().checkAndPossiblyUpdateTheThumbnailsForAnObject(new Map([[IDENTIFIER, null]]), object);

    expect(refreshed).toBe(false);
    expect(await env.thumbnails.get(SMALL_KEY)).toBeNull();
    expect(await env.thumbnails.get(LARGE_KEY)).toBeNull();
  });

  it("ignores objects whose keys are not small or large Google Drive thumbnails", async () => {
    const object = await putThumbnail(IRRELEVANT_KEY, "full-thumbnail");

    const refreshed = await createWorkflow().checkAndPossiblyUpdateTheThumbnailsForAnObject(new Map([[IDENTIFIER, null]]), object);

    expect(refreshed).toBe(false);
    expect(await (await env.thumbnails.get(IRRELEVANT_KEY))?.text()).toBe("full-thumbnail");
  });

  it("does not refresh objects when Google Drive modified time is unavailable", async () => {
    const object = await putThumbnail(SMALL_KEY, "small-thumbnail");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const refreshed = await createWorkflow().checkAndPossiblyUpdateTheThumbnailsForAnObject(new Map(), object);

    expect(refreshed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    const stored = await env.thumbnails.get(SMALL_KEY);
    expect(stored ? await readBody(stored) : undefined).toBe("small-thumbnail");
  });

  it("does not refresh thumbnails that are already up to date", async () => {
    const object = await putThumbnail(SMALL_KEY, "small-thumbnail");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const refreshed = await createWorkflow().checkAndPossiblyUpdateTheThumbnailsForAnObject(
      new Map([[IDENTIFIER, new Date(object.uploaded.getTime() - 1000)]]),
      object
    );

    expect(refreshed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes both thumbnail sizes when the cached object is stale", async () => {
    const object = await putThumbnail(SMALL_KEY, "old-small");
    await putThumbnail(LARGE_KEY, "old-large");
    const fetchMock = vi.fn(async (url: string) => new Response(`refreshed:${url}`, { headers: { "content-length": "100" } }));
    vi.stubGlobal("fetch", fetchMock);

    const refreshed = await createWorkflow().checkAndPossiblyUpdateTheThumbnailsForAnObject(
      new Map([[IDENTIFIER, new Date(object.uploaded.getTime() + 1000)]]),
      object
    );

    expect(refreshed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://lh4.googleusercontent.com/d/workflow-image=h400");
    expect(fetchMock).toHaveBeenCalledWith("https://lh4.googleusercontent.com/d/workflow-image=h800");

    const small = await env.thumbnails.get(SMALL_KEY);
    const large = await env.thumbnails.get(LARGE_KEY);
    expect(small ? await readBody(small) : undefined).toBe("refreshed:https://lh4.googleusercontent.com/d/workflow-image=h400");
    expect(large ? await readBody(large) : undefined).toBe("refreshed:https://lh4.googleusercontent.com/d/workflow-image=h800");
  });

  it("processes up to ten R2 list pages in one workflow step", async () => {
    const list = vi.fn(async ({ cursor }: R2ListOptions) => {
      const pageIndex = cursor === undefined ? 0 : Number(cursor.replace("cursor-", ""));
      return {
        objects: [
          {
            key: `page-${pageIndex}-small-google_drive`,
            uploaded: new Date("2021-01-01T00:00:00.000Z"),
          },
        ],
        truncated: true,
        cursor: `cursor-${pageIndex + 1}`,
        delimitedPrefixes: [],
      };
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://www.googleapis.com/oauth2/v4/token") {
        return Response.json({ access_token: "test-token" });
      }
      return createBatchModifiedTimesResponse(init?.body);
    });
    vi.stubGlobal("fetch", fetchMock);

    const workflow = createWorkflowWithEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN: "refresh-token",
      GOOGLE_DRIVE_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
      thumbnails: { list },
    } as unknown as Env);

    const result = await workflow.processBatch(0, undefined);

    expect(list).toHaveBeenCalledTimes(10);
    expect(result).toEqual({ nextCursor: "cursor-10", truncated: true });
  });
});
