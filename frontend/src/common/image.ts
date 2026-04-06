import { CardDocument } from "./types";

export const getImageKey = (
  cardDocument: CardDocument,
  size: "small" | "large"
): string => {
  return `${cardDocument.identifier}-${size}-${cardDocument.sourceType
    ?.toLowerCase()
    .replace(" ", "_")}`;
};

export const getImageBucketURL = () => process.env.NEXT_PUBLIC_IMAGE_BUCKET_URL;
export const getImageWorkerURL = () => process.env.NEXT_PUBLIC_IMAGE_WORKER_URL;

export const getBucketThumbnailURL = (
  cardDocument: CardDocument,
  size: "small" | "large" | "full"
) => {
  if (size === "full") {
    throw new Error(
      "Cannot get full-res image through bucket, fetch through worker instead"
    );
  }
  const imageBucketURL = getImageBucketURL();
  // TODO: support other source types through CDN here
  const imageBucketURLValid =
    imageBucketURL != null && !!(cardDocument.sourceType === "Google Drive");
  const base = imageBucketURL?.startsWith("https://")
    ? imageBucketURL
    : `https://${imageBucketURL}`;
  return imageBucketURLValid
    ? new URL(getImageKey(cardDocument, size), base).toString()
    : undefined;
};

export const getWorkerThumbnailURL = (
  cardDocument: CardDocument,
  size: "small" | "large" | "full"
) => {
  const imageWorkerURL = getImageWorkerURL();
  const imageWorkerURLValid =
    imageWorkerURL != null && !!(cardDocument?.sourceType === "Google Drive");
  const base = imageWorkerURL?.startsWith("https://")
    ? imageWorkerURL
    : `https://${imageWorkerURL}`;
  return imageWorkerURLValid
    ? new URL(
        `/images/google_drive/${size}/${cardDocument?.identifier}.jpg`,
        base
      ).toString()
    : undefined;
};
