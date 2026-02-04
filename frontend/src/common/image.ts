import { CardDocument } from "./types";

export const getImageKey = (
  cardDocument: CardDocument,
  small: boolean
): string => {
  return `${cardDocument.identifier}-${
    small ? "small" : "large"
  }-${cardDocument.sourceType?.toLowerCase().replace(" ", "_")}`;
};

export const getImageBucketURL = () => process.env.NEXT_PUBLIC_IMAGE_BUCKET_URL;
export const getImageWorkerURL = () => process.env.NEXT_PUBLIC_IMAGE_WORKER_URL;

export const getBucketThumbnailURL = (
  cardDocument: CardDocument,
  small: boolean
) => {
  const imageBucketURL = getImageBucketURL();
  // TODO: support other source types through CDN here
  const imageBucketURLValid =
    imageBucketURL != null && !!(cardDocument.sourceType === "Google Drive");
  return imageBucketURLValid
    ? `${imageBucketURL}/${getImageKey(cardDocument, small)}`
    : undefined;
};

export const getWorkerThumbnailURL = (
  cardDocument: CardDocument,
  small: boolean
) => {
  const imageWorkerURL = getImageWorkerURL();
  const imageWorkerURLValid =
    imageWorkerURL != null && !!(cardDocument?.sourceType === "Google Drive");
  return imageWorkerURLValid
    ? `${imageWorkerURL}/images/google_drive/${small ? "small" : "large"}/${
        cardDocument?.identifier
      }.jpg`
    : undefined;
};

export const getWorkerFullResURL = (
  cardDocument: CardDocument,
  dpi: number,
  quality: number
) => {
  const imageWorkerURL = getImageWorkerURL();
  const imageWorkerURLValid =
    imageWorkerURL != null && !!(cardDocument?.sourceType === "Google Drive");
  return imageWorkerURLValid
    ? `${imageWorkerURL}/images/google_drive/full/${cardDocument?.identifier}.jpg?dpi=${dpi}&quality=${quality}`
    : undefined;
};
