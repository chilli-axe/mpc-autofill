type ImageType = "google_drive";
type ImageSize = "small" | "large" | "full";
enum ImageSizes {
  "small" = 400,
  "large" = 800,
}

function assertUnreachable(x: never): never {
  throw new Error(`Didn't expect to get here with ${x}`);
}

const getImageKey = (imageType: ImageType, imageSize: ImageSize, imageIdentifier: string): string =>
  `${imageIdentifier}-${imageSize}-${imageType}`;
const getImageURL = (imageType: ImageType, imageSize: ImageSize, imageIdentifier: string): string => {
  switch (imageType) {
    case "google_drive":
      switch (imageSize) {
        case "small":
        case "large":
          return `https://drive.google.com/thumbnail?sz=w${ImageSizes[imageSize]}-h${ImageSizes[imageSize]}&id=${imageIdentifier}`;
        case "full":
          return `https://drive.usercontent.google.com/download?id=${imageIdentifier}&export=view&authuser=0`;
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
  console.log(`Getting image ${imageKey}`);
  const object = await env.thumbnails.get(imageKey);
  if (object === null) {
    // image hasn't been cached yet - serve it from gdrive while caching it in the background
    console.log(`Proxying request to ${imageKey} & caching in background`);
    ctx.waitUntil(putImage(env, imageURL, imageKey));
    return fetch(imageURL);
  } else {
    console.log(`Serving cached image ${imageKey}`);
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
  console.log(`Putting image ${imageKey}`);
  const imageExists = (await env.thumbnails.head(imageKey)) != null;
  if (!imageExists) {
    console.log("Image is not stored");
  } else if (isResync) {
    console.log("Resync forced");
  }
  if (isResync || !imageExists) {
    await fetch(imageURL)
      .then(async (response) => {
        if (response.ok && response.body && response.headers.get("content-length") != null) {
          console.log(`Successfully fetched ${imageKey}`);
          if (isResync && imageExists) {
            console.log("Resyncing - deleting the existing object before re-saving");
            await env.thumbnails.delete(imageKey);
          }
          console.log("About to save to R2");
          await env.thumbnails.put(imageKey, response.body, { httpMetadata: { ...response.headers, contentType: "image/jpg" } });
        } else {
          console.log(`The fetch for ${imageURL} was not successful :(`);
        }
      })
      .catch(console.error);
  } else {
    console.log("Image is stored");
  }
  console.log("All done!");
};

const getFullResolutionImage = async (request: Request, env: Env, ctx: ExecutionContext, imageIdentifier: string): Promise<Response> => {
  const googleDriveAccessToken = await getGoogleDriveAccessToken(env);
  if (!googleDriveAccessToken) {
    console.log("Couldn't get access token");
    return new Response("Could not access Google Drive API.", { status: 500 });
  }
  let response = await fetch(`https://www.googleapis.com/drive/v3/files/${imageIdentifier}?alt=media`, {
    headers: { Authorization: `Bearer ${googleDriveAccessToken}` },
    method: "GET",
  });
  response = new Response(response.body, response);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.append("Vary", "Origin");
  response.headers.set("Content-Type", "image/jpeg");
  return response;
};

const handleImageRequest = async (url: URL, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
  const pathRegex = new RegExp(/^\/images\/(google_drive)\/(small|large|full)\/(.+)\.jpg$/);
  const unpackedPath = pathRegex.exec(url.pathname);
  if (unpackedPath === null) {
    return new Response(`Malformed URL.`, { status: 400 });
  }
  const imageType: ImageType = unpackedPath[1] as ImageType;
  const imageSize: ImageSize = unpackedPath[2] as ImageSize;
  const imageIdentifier = unpackedPath[3];

  const imageKey = getImageKey(imageType, imageSize, imageIdentifier);
  const imageURL = getImageURL(imageType, imageSize, imageIdentifier);

  switch (request.method) {
    case "GET":
      if (imageSize === "small" || imageSize === "large") {
        return getThumbnail(env, ctx, imageURL, imageKey);
      } else if (imageSize === "full") {
        return getFullResolutionImage(request, env, ctx, imageIdentifier);
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
    console.log(`Couldn't extract identifier from ${object.key}`);
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
    console.log(`Received response code ${response.status} when querying modifiedTime for ${identifier}`, response.body);
    if (responseStatusWas404) {
      console.log(`Removing ${identifier} from system following 404...`);
      for (const size of ["small", "large"] as Array<ImageSize>) {
        const imageKey = getImageKey("google_drive", size, identifier);
        await env.thumbnails.delete(imageKey);
      }
      console.log(`Removed ${identifier} from system.`);
    }
    return false;
  }
  const responseJson = await response.json<{ modifiedTime: string }>();
  const googleDriveTime = new Date(responseJson.modifiedTime);
  const stale = googleDriveTime > object.uploaded;
  if (stale) {
    console.log(`${identifier} is stale - refreshing thumbnails`);
    for (const size of ["small", "large"] as Array<ImageSize>) {
      const imageKey = getImageKey("google_drive", size, identifier);
      const imageURL = getImageURL("google_drive", size, identifier);
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
    console.log("Couldn't get access token");
    return;
  }
  console.log(`Checking image staleness with cursor ${cursor}`);
  const [newCursor, truncated, objects] = await getABunchOfObjects(env, cursor);
  console.log(`Working on ${objects.length} images...`);
  for (const obj of objects) {
    await checkAndPossiblyUpdateTheThumbnailsForAnObject(env, ctx, googleDriveAccessToken, obj);
  }
  console.log("and done!");

  // enqueue a message to process the next batch :)
  if (truncated && newCursor !== undefined) {
    console.log(`More work to do - enqueueing another worker with cursor ${newCursor}`);
    await env.thumbnailRefreshQueue.send(newCursor);
  } else {
    console.log("No more work to do :)");
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
  async scheduled(event: Event, env: Env, ctx: ExecutionContext) {
    await processAndEnqueue(env, ctx, undefined);
  },
  async queue(batch: MessageBatch<string>, env: Env, ctx: ExecutionContext): Promise<void> {
    const messages = batch.messages;
    if (messages.length !== 1) {
      console.log(`Expected to only receive one cursor, but received ${messages.length}`);
      return;
    }
    const cursor = messages[0].body;
    await processAndEnqueue(env, ctx, cursor);
  },
};

export default defaultExport;
