type ImageType = "google_drive";
type ImageSize = "small" | "large" | "full";
enum ImageSizes {
  "small" = 400,
  "large" = 800,
}

function assertUnreachable(x: never): never {
  throw new Error(`Didn't expect to get here with ${x}`);
}

const getLH4Params = (height: number | undefined, jpgQuality: number): string => {
  // https://gist.github.com/Sauerstoffdioxid/2a0206da9f44dde1fdfce290f38d2703
  const params = [...(height !== undefined ? [`h${height}`] : []), ...(jpgQuality < 100 ? ["rj", `l${jpgQuality}`] : [])];
  return params.length > 0 ? `=${params.join("-")}` : "";
};

const getLH4URL = (imageIdentifier: string, height: number | undefined, jpgQuality: number): string =>
  `https://lh4.googleusercontent.com/d/${imageIdentifier}${getLH4Params(height, jpgQuality)}`;

const getImageKey = (imageType: ImageType, imageSize: ImageSize, imageIdentifier: string): string =>
  `${imageIdentifier}-${imageSize}-${imageType}`;
const getImageURL = (
  imageType: ImageType,
  imageSize: ImageSize,
  dpi: number | undefined,
  jpgQuality: number,
  imageIdentifier: string
): string => {
  switch (imageType) {
    case "google_drive":
      switch (imageSize) {
        case "small":
        case "large":
          return getLH4URL(imageIdentifier, ImageSizes[imageSize], jpgQuality);
        case "full":
          const height = dpi ? (dpi * 1110) / 300 : undefined;
          return getLH4URL(imageIdentifier, height, jpgQuality);
        default:
          return assertUnreachable(imageSize);
      }
    default:
      return assertUnreachable(imageType);
  }
};

async function getGoogleDriveAccessToken(env: Env): Promise<string | undefined> {
  /**
   * Retrieve a token for accessing the Google Drive API.
   */

  const tokenResponse = await fetch("https://www.googleapis.com/oauth2/v4/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const tokenData: { access_token?: string } = await tokenResponse.json();
  if (tokenData?.access_token == null) {
    console.warn("Failed to retrieve Google Drive access token", await tokenResponse.json());
  }
  return tokenData?.access_token;
}

const getThumbnail = async (env: Env, ctx: ExecutionContext, imageURL: string, imageKey: string): Promise<Response> => {
  const object = await env.thumbnails.get(imageKey);
  if (object === null) {
    // image hasn't been cached yet - serve it from gdrive while caching it in the background
    ctx.waitUntil(putImage(env, imageURL, imageKey));
    return fetch(imageURL);
  } else {
    // serve the cached image
    const headers = new Headers();
    const data = await object.arrayBuffer();
    object.writeHttpMetadata(headers);
    return new Response(data, {
      headers,
    });
  }
};

const putImage = async (env: Env, imageURL: string, imageKey: string, isResync: boolean = false): Promise<void> => {
  const imageExists = (await env.thumbnails.head(imageKey)) != null;
  if (isResync || !imageExists) {
    await fetch(imageURL)
      .then(async (response) => {
        if (response.ok && response.body && response.headers.get("content-length") != null) {
          if (isResync && imageExists) {
            await env.thumbnails.delete(imageKey);
          }
          await env.thumbnails.put(imageKey, response.body, { httpMetadata: { ...response.headers, contentType: "image/jpg" } });
        }
      })
      .catch(console.error);
  }
};

const handleImageRequest = async (url: URL, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
  const pathRegex = new RegExp(/^\/images\/(google_drive)\/(small|large|full)\/(.+)\.jpg$/);
  const unpackedPath = pathRegex.exec(url.pathname);
  const rawDpi = url.searchParams.get("dpi");
  const rawJPGQuality = url.searchParams.get("jpgQuality");
  const dpi: number | undefined = rawDpi ? parseInt(rawDpi) : undefined;
  if (dpi !== undefined && !(dpi > 0 && dpi <= 1500)) {
    throw new Error(`invalid DPI ${rawDpi}`);
  }
  const jpgQuality: number | undefined = rawJPGQuality ? parseInt(rawJPGQuality) : 100;
  if (jpgQuality !== undefined && !(jpgQuality > 0 && jpgQuality <= 100)) {
    throw new Error(`invalid JPG quality ${rawJPGQuality}`);
  }
  if (unpackedPath === null) {
    return new Response(`Malformed URL.`, { status: 400 });
  }
  const imageType: ImageType = unpackedPath[1] as ImageType;
  const imageSize: ImageSize = unpackedPath[2] as ImageSize;
  const imageIdentifier = unpackedPath[3];

  const imageKey = getImageKey(imageType, imageSize, imageIdentifier);

  switch (request.method) {
    case "GET":
      switch (imageSize) {
        case "small":
        case "large":
          return getThumbnail(env, ctx, getImageURL(imageType, imageSize, undefined, jpgQuality, imageIdentifier), imageKey);
        case "full":
          const url = getImageURL(imageType, imageSize, dpi, jpgQuality, imageIdentifier);
          return fetch(url);
        default:
          throw new Error(`Invalid image size ${imageSize}`);
      }
    default:
      return new Response(`Invalid method ${request.method}. GET or PUT expected.`, { status: 400 });
  }
};

const getABunchOfObjects = async (env: Env, cursor: string | undefined): Promise<[string | undefined, boolean, Array<R2Object>]> => {
  const listed = await env.thumbnails.list({
    limit: 100, // set the limit to the max number of images to check per worker instance
    cursor: cursor,
  });
  // @ts-ignore // TODO: having to ts-ignore this is weird.
  const responseCursor: string | undefined = listed.cursor;
  return [responseCursor, listed.truncated, listed.objects];
};

const checkAndPossiblyUpdateTheThumbnailsForAnObject = async (
  env: Env,
  ctx: ExecutionContext,
  googleDriveAccessToken: string,
  object: R2Object
): Promise<boolean> => {
  // TODO: we could consider comparing image checksums rather than comparing datetimes? not sure it matters tbh?
  const re = /^(.*)-(?:small|large)-(google_drive)$/g;
  const results = re.exec(object.key);
  if (!results) {
    return false;
  }
  const identifier = results[1];
  const params = new URLSearchParams({
    driveId: identifier,
    fields: "name, modifiedTime",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${identifier}?${params}`, {
    headers: {
      Authorization: `Bearer ${googleDriveAccessToken}`,
    },
    method: "GET",
  });
  if (response.status !== 200) {
    const responseStatusWas404 = response.status === 404;
    response.body?.cancel();
    if (responseStatusWas404) {
      for (const size of ["small", "large"] as Array<ImageSize>) {
        const imageKey = getImageKey("google_drive", size, identifier);
        await env.thumbnails.delete(imageKey);
      }
    }
    return false;
  }
  const responseJson = await response.json<{ modifiedTime: string }>();
  const googleDriveTime = new Date(responseJson.modifiedTime);
  const stale = googleDriveTime > object.uploaded;
  if (stale) {
    for (const size of ["small", "large"] as Array<ImageSize>) {
      const imageKey = getImageKey("google_drive", size, identifier);
      const imageURL = getImageURL("google_drive", size, undefined, 100, identifier);
      ctx.waitUntil(putImage(env, imageURL, imageKey, true));
    }
    return true;
  } else {
    return false;
  }
};

const processAndEnqueue = async (env: Env, ctx: ExecutionContext, cursor: string | undefined): Promise<void> => {
  const googleDriveAccessToken = await getGoogleDriveAccessToken(env);
  if (!googleDriveAccessToken) {
    return;
  }
  const [newCursor, truncated, objects] = await getABunchOfObjects(env, cursor);
  for (const obj of objects) {
    await checkAndPossiblyUpdateTheThumbnailsForAnObject(env, ctx, googleDriveAccessToken, obj);
  }

  // enqueue a message to process the next batch :)
  if (truncated && newCursor !== undefined) {
    await env.thumbnailRefreshQueue.send(newCursor);
  }
};

// yoink https://developers.cloudflare.com/workers/examples/cors-header-proxy/
async function handleOptions(request: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (
    request.headers.get("Origin") !== null &&
    request.headers.get("Access-Control-Request-Method") !== null &&
    request.headers.get("Access-Control-Request-Headers") !== null
  ) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") ?? "",
      },
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    });
  }
}

const defaultExport = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/images/")) {
      if (request.method === "OPTIONS") {
        // Handle CORS preflight requests
        return handleOptions(request);
      } else if (request.method === "GET") {
        return await handleImageRequest(url, request, env, ctx);
      }
      return new Response(`Unsupported HTTP method.`, { status: 400 });
    } else {
      return new Response(`Unknown endpoint.`, { status: 404 });
    }
  },
  // async scheduled(event: Event, env: Env, ctx: ExecutionContext) {
  //   await processAndEnqueue(env, ctx, undefined);
  // },
  async queue(batch: MessageBatch<string>, env: Env, ctx: ExecutionContext): Promise<void> {
    const messages = batch.messages;
    if (messages.length !== 1) {
      return;
    }
    const cursor = messages[0].body;
    await processAndEnqueue(env, ctx, cursor);
  },
};

export default defaultExport;
