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

const attachHttpsPrefix = (url: string): string =>
  url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;

export const getBucketImageURL = (
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
  return imageBucketURLValid
    ? new URL(
        getImageKey(cardDocument, size),
        attachHttpsPrefix(imageBucketURL)
      ).toString()
    : undefined;
};

export const getWorkerImageURL = (
  cardDocument: CardDocument,
  size: "small" | "large" | "full",
  dpi: number | undefined = undefined,
  jpgQuality: number = 100
) => {
  const imageWorkerURL = getImageWorkerURL();
  const imageWorkerURLValid =
    imageWorkerURL != null && !!(cardDocument?.sourceType === "Google Drive");
  const params = new URLSearchParams({
    ...(dpi !== undefined && size === "full" ? { dpi: dpi.toString() } : {}),
    jpgQuality: jpgQuality.toString(),
  });
  return imageWorkerURLValid
    ? new URL(
        `/images/google_drive/${size}/${cardDocument?.identifier}.jpg?${params}`,
        attachHttpsPrefix(imageWorkerURL)
      ).toString()
    : undefined;
};
