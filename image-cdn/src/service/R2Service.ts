import { ImageSize, ImageType } from "../types";

export class R2Service {
  static getImageKey(imageType: ImageType, imageSize: ImageSize, imageIdentifier: string): string {
    return `${imageIdentifier}-${imageSize}-${imageType}`;
  }

  static async getThumbnail(env: Env, ctx: ExecutionContext, imageURL: string, imageKey: string): Promise<Response> {
    console.log(`Getting image ${imageKey}`);
    const object = await env.thumbnails.get(imageKey);
    if (object === null) {
      // image hasn't been cached yet - serve it from gdrive while caching it in the background
      console.log(`Proxying request to ${imageKey} & caching in background`);
      ctx.waitUntil(this.putImage(env, imageURL, imageKey)); // TODO: consider firing off separate worker to cache the image to improve latency
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
  }

  static async putImage(env: Env, imageURL: string, imageKey: string, isResync: boolean = false): Promise<void> {
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
            // TODO: research whether an explicit `delete` prior to `put` is necessary
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
  }
}
