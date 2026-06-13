import type { WorkflowEvent } from "cloudflare:workers";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";

import { GoogleDriveService } from "../service/GoogleDriveService";
import { R2Service } from "../service/R2Service";
import { ImageSize } from "../types";
import { getImageURL } from "../url";

const IMAGES_PER_R2_LIST_CALL = 1000;

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
    const googleDriveService = new GoogleDriveService();
    await googleDriveService.refreshAccessToken(this.env);
    if (!googleDriveService.accessToken) {
      throw new Error("Couldn't get access token");
    }

    const listed = await this.env.thumbnails.list({ limit: IMAGES_PER_R2_LIST_CALL, cursor });
    if (listed.objects.length === 0) {
      console.log("No objects to process - exiting");
      return { nextCursor: undefined, truncated: false };
    }

    console.log(`Processing batch ${batchIndex} (cursor: ${cursor ?? "start"}), ${listed.objects.length} objects`);

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

    return { nextCursor: listed.truncated ? listed.cursor : undefined, truncated: listed.truncated };
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
