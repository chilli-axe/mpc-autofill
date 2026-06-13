import type { WorkflowEvent } from "cloudflare:workers";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";

import { ImageNotFoundError } from "../error";
import { GoogleDriveService } from "../service/GoogleDriveService";
import { R2Service } from "../service/R2Service";
import { ImageSize } from "../types";
import { getImageURL } from "../url";

// stub for now, rewrite below functions into workflow
export class ThumbnailRefreshWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Steps here
  }
}

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
  googleDriveService: GoogleDriveService,
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

  try {
    const googleDriveTime = await googleDriveService.getModifiedTime(identifier);
    if (googleDriveTime === undefined) {
      console.log(`Could not fetch modifiedTime for image ${identifier}`);
      return false;
    }
    const stale = googleDriveTime > object.uploaded;
    if (stale) {
      console.log(`${identifier} is stale - refreshing thumbnails`);
      for (const size of ["small", "large"] as Array<ImageSize>) {
        const imageKey = R2Service.getImageKey("google_drive", size, identifier);
        const imageURL = getImageURL("google_drive", size, undefined, 100, identifier);
        ctx.waitUntil(R2Service.putImage(env, imageURL, imageKey, true));
      }
      return true;
    } else {
      return false;
    }
  } catch (err) {
    if (err instanceof ImageNotFoundError) {
      console.log(`Removing ${identifier} from system following 404...`);
      for (const size of ["small", "large"] as Array<ImageSize>) {
        const imageKey = R2Service.getImageKey("google_drive", size, identifier);
        await env.thumbnails.delete(imageKey);
      }
      console.log(`Removed ${identifier} from system.`);
      return false;
    } else {
      throw err;
    }
  }
};

export const processAndEnqueue = async (env: Env, ctx: ExecutionContext, cursor: string | undefined): Promise<void> => {
  const googleDriveService = new GoogleDriveService();
  await googleDriveService.refreshAccessToken(env);
  if (!googleDriveService.accessToken) {
    console.log("Couldn't get access token");
    return;
  }

  console.log(`Checking image staleness with cursor ${cursor}`);
  const [newCursor, truncated, objects] = await getABunchOfObjects(env, cursor);
  console.log(`Working on ${objects.length} images...`);
  for (const obj of objects) {
    await checkAndPossiblyUpdateTheThumbnailsForAnObject(env, ctx, googleDriveService, obj);
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
