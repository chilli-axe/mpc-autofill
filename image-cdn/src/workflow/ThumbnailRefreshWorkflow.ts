import type { WorkflowEvent } from "cloudflare:workers";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";

import { GoogleDriveService } from "../service/GoogleDriveService";
import { R2Service } from "../service/R2Service";
import { ImageSize } from "../types";
import { getImageURL } from "../url";

const IMAGES_PER_R2_LIST_CALL = 1000;
const R2_LIST_CALLS_PER_WORKFLOW_STEP = 10;

export class ThumbnailRefreshWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    let cursor: string | undefined = undefined;
    let batchIndex: number = 0;

    while (true) {
      const { nextCursor, truncated } = await step.do(`process-batch-${batchIndex}`, async () => this.processBatch(batchIndex, cursor));
      if (!truncated || nextCursor === undefined) {
        break;
      }
      cursor = nextCursor;
      batchIndex += 1;
    }
  }

  async processBatch(batchIndex: number, cursor: string | undefined): Promise<{ nextCursor: string | undefined; truncated: boolean }> {
    const googleDriveService = new GoogleDriveService(this.env);
    await googleDriveService.refreshAccessToken(this.env);
    if (!googleDriveService.accessToken) {
      throw new Error("Couldn't get access token");
    }

    let nextCursor = cursor;
    let truncated = false;

    for (let pageIndex = 0; pageIndex < R2_LIST_CALLS_PER_WORKFLOW_STEP; pageIndex++) {
      const listed = await this.env.thumbnails.list({ limit: IMAGES_PER_R2_LIST_CALL, cursor: nextCursor });
      if (listed.objects.length === 0) {
        console.log("No objects to process - exiting");
        return { nextCursor: undefined, truncated: false };
      }

      console.log(
        `Processing batch ${batchIndex}, R2 page ${pageIndex + 1}/${R2_LIST_CALLS_PER_WORKFLOW_STEP} (cursor: ${nextCursor ?? "start"}), ${
          listed.objects.length
        } objects`
      );

      const identifiers = [
        ...new Set(
          listed.objects.flatMap((obj) => {
            const match = /^(.*)-(?:small|large)-google_drive$/.exec(obj.key);
            return match ? [match[1]] : [];
          })
        ),
      ];
      const modifiedTimes = await googleDriveService.getBatchModifiedTimes(identifiers);

      await Promise.all(listed.objects.map((obj) => this.checkAndPossiblyUpdateTheThumbnailsForAnObject(modifiedTimes, obj)));

      truncated = listed.truncated;
      nextCursor = listed.truncated ? listed.cursor : undefined;
      if (!listed.truncated || nextCursor === undefined) {
        return { nextCursor, truncated };
      }
    }

    return { nextCursor, truncated };
  }

  async checkAndPossiblyUpdateTheThumbnailsForAnObject(modifiedTimes: Map<string, Date | null>, object: R2Object): Promise<boolean> {
    const re = /^(.*)-(?:small|large)-(google_drive)$/g;
    const results = re.exec(object.key);
    if (!results) {
      console.log(`Couldn't extract identifier from ${object.key}`);
      return false;
    }
    const identifier = results[1];
    const googleDriveTime = modifiedTimes.get(identifier);

    if (googleDriveTime === null) {
      console.log(`Removing ${identifier} from system following 404...`);
      await Promise.all(
        (["small", "large"] as Array<ImageSize>).map((size) =>
          this.env.thumbnails.delete(R2Service.getImageKey("google_drive", size, identifier))
        )
      );
      return false;
    }

    if (googleDriveTime === undefined) {
      console.log(`Could not fetch modifiedTime for image ${identifier}`);
      return false;
    }

    if (googleDriveTime > object.uploaded) {
      console.log(`${identifier} is stale - refreshing thumbnails`);
      await Promise.all(
        (["small", "large"] as Array<ImageSize>).map((size) => {
          const imageKey = R2Service.getImageKey("google_drive", size, identifier);
          const imageURL = getImageURL("google_drive", size, undefined, 100, identifier);
          return R2Service.putImage(this.env, imageURL, imageKey, true);
        })
      );
      return true;
    }

    return false;
  }
}
