import { handleOptionsRequest } from "./handler/cors";
import { handleImageRequest } from "./handler/image";

const defaultExport = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/images/")) {
      if (request.method === "OPTIONS") {
        return handleOptionsRequest(request);
      } else if (request.method === "GET") {
        return await handleImageRequest(url, request, env, ctx);
      }
      return new Response(`Unsupported HTTP method.`, { status: 400 });
    } else {
      return new Response(`Unknown endpoint.`, { status: 404 });
    }
  },
};

export { ThumbnailRefreshWorkflow } from "./workflow/ThumbnailRefreshWorkflow";
export default defaultExport;
