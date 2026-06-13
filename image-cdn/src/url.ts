import { GoogleDriveService } from "./service/GoogleDriveService";
import { ImageSize, ImageSizes, ImageType } from "./types";
import { assertUnreachable } from "./utils";

export const getImageKey = (imageType: ImageType, imageSize: ImageSize, imageIdentifier: string): string =>
  `${imageIdentifier}-${imageSize}-${imageType}`;

export const getImageURL = (
  imageType: ImageType,
  imageSize: ImageSize,
  dpi: number | undefined,
  jpgQuality: number,
  imageIdentifier: string
): string => {
  switch (imageType) {
    case "google_drive":
      switch (imageSize) {
        case "small":
        case "large":
          return GoogleDriveService.getImageURL(imageIdentifier, ImageSizes[imageSize], jpgQuality);
        case "full":
          const height = dpi ? (dpi * 1110) / 300 : undefined;
          return GoogleDriveService.getImageURL(imageIdentifier, height, jpgQuality);
        default:
          return assertUnreachable(imageSize);
      }
    default:
      return assertUnreachable(imageType);
  }
};
