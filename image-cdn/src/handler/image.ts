import { R2Service } from "../service/R2Service";
import { ImageSize, ImageType } from "../types";
import { getImageURL } from "../url";

export const handleImageRequest = async (url: URL, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
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

  const response = await (async () => {
    switch (request.method) {
      case "GET":
        switch (imageSize) {
          case "small":
          case "large":
            return R2Service.getThumbnail(env, ctx, getImageURL(imageType, imageSize, undefined, jpgQuality, imageIdentifier), imageKey);
          case "full":
            const url = getImageURL(imageType, imageSize, dpi, jpgQuality, imageIdentifier);
            return fetch(url);
          default:
            throw new Error(`Invalid image size ${imageSize}`);
        }
      default:
        return new Response(`Invalid method ${request.method}. GET or PUT expected.`, { status: 400 });
    }
  })();

  // Callers (the browser's main thread, and the PDF renderer's Worker context)
  // fetch() these images cross-origin, which requires an explicit CORS header
  // on the actual response - the OPTIONS preflight handler alone isn't enough.
  // The "full" tier previously worked by accident because Google's own response
  // happens to carry a permissive CORS header; don't rely on that.
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
