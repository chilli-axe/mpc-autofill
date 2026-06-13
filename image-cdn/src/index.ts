import { R2Service } from "./service/R2Service";
import { ImageSize, ImageType } from "./types";
import { getImageURL } from "./url";

export { ThumbnailRefreshWorkflow } from "./workflow/ThumbnailRefreshWorkflow";

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

  const imageKey = R2Service.getImageKey(imageType, imageSize, imageIdentifier);

  switch (request.method) {
    case "GET":
      switch (imageSize) {
        case "small":
        case "large":
          return R2Service.getThumbnail(env, ctx, getImageURL(imageType, imageSize, undefined, jpgQuality, imageIdentifier), imageKey);
        case "full":
          const url = getImageURL(imageType, imageSize, dpi, jpgQuality, imageIdentifier);
          console.log(url);
          return fetch(url);
        default:
          throw new Error(`Invalid image size ${imageSize}`);
      }
    default:
      return new Response(`Invalid method ${request.method}. GET or PUT expected.`, { status: 400 });
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
};

export default defaultExport;
