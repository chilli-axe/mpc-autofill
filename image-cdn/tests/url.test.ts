import { describe, expect, it } from "vitest";

import { GoogleDriveService } from "../src/service/GoogleDriveService";
import { getImageURL } from "../src/url";

describe("getImageURL", () => {
  it("builds Google Drive thumbnail URLs for fixed image sizes", () => {
    expect(getImageURL("google_drive", "small", undefined, 100, "image-id")).toBe("https://lh4.googleusercontent.com/d/image-id=h400");
    expect(getImageURL("google_drive", "large", undefined, 85, "image-id")).toBe(
      "https://lh4.googleusercontent.com/d/image-id=h800-rj-l85"
    );
  });

  it("builds full-size Google Drive URLs from optional dpi and quality parameters", () => {
    expect(getImageURL("google_drive", "full", undefined, 100, "image-id")).toBe("https://lh4.googleusercontent.com/d/image-id");
    expect(getImageURL("google_drive", "full", 600, 95, "image-id")).toBe("https://lh4.googleusercontent.com/d/image-id=h2220-rj-l95");
  });
});

describe("GoogleDriveService URL helpers", () => {
  it("omits lh4 parameters when no height is requested and quality is lossless", () => {
    expect(GoogleDriveService.getLH4Params(undefined, 100)).toBe("");
  });

  it("combines height and jpeg quality parameters when requested", () => {
    expect(GoogleDriveService.getLH4Params(400, 80)).toBe("=h400-rj-l80");
    expect(GoogleDriveService.getImageURL("image-id", 400, 80)).toBe("https://lh4.googleusercontent.com/d/image-id=h400-rj-l80");
  });
});
