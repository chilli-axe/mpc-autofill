import { ImageSize, ImageType } from "../types";

export class R2Service {
  static getImageKey(imageType: ImageType, imageSize: ImageSize, imageIdentifier: string): string {
    return `${imageIdentifier}-${imageSize}-${imageType}`;
  }

  static async getThumbnail(env: Env, ctx: ExecutionContext, imageURL: string, imageKey: string): Promise<Response> {
    const object = await env.thumbnails.get(imageKey);
    if (object === null) {
      // image hasn't been cached yet - serve it from gdrive while caching it in the background
      console.log(`Proxying request to ${imageKey} & caching in background`);
      ctx.waitUntil(this.putImage(env, imageURL, imageKey)); // TODO: consider firing off separate worker to cache the image to improve latency
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
  }

  static async putImage(env: Env, imageURL: string, imageKey: string, isResync: boolean = false): Promise<void> {
    const imageExists = (await env.thumbnails.head(imageKey)) != null;
    if (isResync || !imageExists) {
      await fetch(imageURL)
        .then(async (response) => {
          if (response.ok && response.body && response.headers.get("content-length") != null) {
            // TODO: research whether an explicit `delete` prior to `put` is necessary
            if (isResync && imageExists) {
              await env.thumbnails.delete(imageKey);
            }
            await env.thumbnails.put(imageKey, response.body, { httpMetadata: { ...response.headers, contentType: "image/jpg" } });
          } else {
            console.log(`Attempted to fetch image for PUT but was unsuccessful: ${imageURL}`, response);
          }
        })
        .catch(console.error);
    }
  }
}
