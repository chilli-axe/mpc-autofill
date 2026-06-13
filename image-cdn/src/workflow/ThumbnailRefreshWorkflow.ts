import type { WorkflowEvent } from "cloudflare:workers";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";

import { ImageNotFoundError } from "../error";
import { GoogleDriveService } from "../service/GoogleDriveService";
import { R2Service } from "../service/R2Service";
import { ImageSize } from "../types";
import { getImageURL } from "../url";

const checkAndPossiblyUpdateTheThumbnailsForAnObject = async (
  env: Env,
  googleDriveService: GoogleDriveService,
  object: R2Object
): Promise<boolean> => {
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
      await Promise.all(
        (["small", "large"] as Array<ImageSize>).map((size) => {
          const imageKey = R2Service.getImageKey("google_drive", size, identifier);
          const imageURL = getImageURL("google_drive", size, undefined, 100, identifier);
          return R2Service.putImage(env, imageURL, imageKey, true);
        })
      );
      return true;
    } else {
      return false;
    }
  } catch (err) {
    if (err instanceof ImageNotFoundError) {
      console.log(`Removing ${identifier} from system following 404...`);
      await Promise.all(
        (["small", "large"] as Array<ImageSize>).map((size) =>
          env.thumbnails.delete(R2Service.getImageKey("google_drive", size, identifier))
        )
      );
      console.log(`Removed ${identifier} from system.`);
      return false;
    } else {
      throw err;
    }
  }
};

export class ThumbnailRefreshWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    let cursor: string | undefined = undefined;
    let batchIndex = 0;

    while (true) {
      const { nextCursor, truncated } = await step.do(`process-batch-${batchIndex}`, async () => {
        const googleDriveService = new GoogleDriveService();
        await googleDriveService.refreshAccessToken(this.env);
        if (!googleDriveService.accessToken) {
          throw new Error("Couldn't get access token");
        }

        const listed = await this.env.thumbnails.list({ limit: 100, cursor });

        console.log(`Processing batch ${batchIndex} (cursor: ${cursor ?? "start"}), ${listed.objects.length} objects`);
        for (const obj of listed.objects) {
          await checkAndPossiblyUpdateTheThumbnailsForAnObject(this.env, googleDriveService, obj);
        }

        return { nextCursor: listed.truncated ? listed.cursor : undefined, truncated: listed.truncated };
      });

      if (!truncated || nextCursor === undefined) break;
      cursor = nextCursor;
      batchIndex++;
    }
  }
}
