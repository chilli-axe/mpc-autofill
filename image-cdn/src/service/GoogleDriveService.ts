import { NonRetryableError } from "cloudflare:workflows";

const IMAGES_PER_GOOGLE_DRIVE_BATCH_CALL = 100;

export class GoogleDriveService {
  accessToken: string | undefined;

  async refreshAccessToken(env: Env): Promise<void> {
    if (this.accessToken !== undefined) {
      return;
    }

    if ((env.GOOGLE_CLIENT_ID ?? "") === "") {
      throw new NonRetryableError("GOOGLE_CLIENT_ID not defined!");
    }
    if ((env.GOOGLE_CLIENT_SECRET ?? "") === "") {
      throw new NonRetryableError("GOOGLE_CLIENT_SECRET not defined!");
    }
    if ((env.GOOGLE_REFRESH_TOKEN ?? "") === "") {
      throw new NonRetryableError("GOOGLE_REFRESH_TOKEN not defined!");
    }

    const tokenResponse = await fetch("https://www.googleapis.com/oauth2/v4/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    const tokenData: { access_token?: string } = await tokenResponse.json();
    if (tokenData?.access_token == null) {
      console.warn("Failed to retrieve Google Drive access token", tokenData);
    }

    this.accessToken = tokenData?.access_token;
  }

  // Returns Date for found files, null for 404, absent entry for unexpected errors.
  async getModifiedTimes(identifiers: string[]): Promise<Map<string, Date | null>> {
    if (this.accessToken === undefined) {
      throw new Error("GoogleDrive accessToken undefined");
    }
    if (identifiers.length === 0) {
      return new Map();
    }

    const boundary = `batch_${crypto.randomUUID().replace(/-/g, "")}`;
    const bodyParts = identifiers.map(
      (id) =>
        `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <${id}>\r\n\r\nGET /drive/v3/files/${encodeURIComponent(
          id
        )}?fields=modifiedTime\r\n`
    );
    const body = bodyParts.join("\r\n") + `\r\n--${boundary}--`;

    const response = await fetch("https://www.googleapis.com/batch/drive/v3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    const responseText = await response.text();
    const contentType = response.headers.get("Content-Type") ?? "";
    const boundaryMatch = contentType.match(/boundary=["']?([^"';,\s]+)["']?/);
    if (!boundaryMatch) {
      throw new Error(`Could not parse batch response boundary from: ${contentType}`);
    }
    const responseBoundary = boundaryMatch[1];

    return GoogleDriveService.parseBatchModifiedTimesResponse(responseText, responseBoundary);
  }

  async getBatchModifiedTimes(identifiers: string[]): Promise<Map<string, Date | null>> {
    const chunks: string[][] = [];
    for (let i = 0; i < identifiers.length; i += IMAGES_PER_GOOGLE_DRIVE_BATCH_CALL) {
      chunks.push(identifiers.slice(i, i + IMAGES_PER_GOOGLE_DRIVE_BATCH_CALL));
    }
    const results = await Promise.all(chunks.map((chunk) => this.getModifiedTimes(chunk)));
    return new Map(results.flatMap((m) => [...m]));
  }

  static parseBatchModifiedTimesResponse(responseText: string, boundary: string): Map<string, Date | null> {
    const result = new Map<string, Date | null>();
    for (const part of responseText.split(`--${boundary}`)) {
      const contentIdMatch = part.match(/Content-ID:\s*<response-([^>]+)>/i);
      if (!contentIdMatch) continue;
      const id = contentIdMatch[1];

      const statusMatch = part.match(/HTTP\/[\d.]+ (\d+)/);
      if (!statusMatch) continue;
      const status = parseInt(statusMatch[1], 10);

      if (status === 404) {
        result.set(id, null);
      } else if (status === 200) {
        const jsonStart = part.indexOf("{");
        const jsonEnd = part.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          try {
            const data = JSON.parse(part.slice(jsonStart, jsonEnd + 1)) as { modifiedTime?: string };
            if (data.modifiedTime) {
              result.set(id, new Date(data.modifiedTime));
            }
          } catch (err) {
            console.warn(`Failed to parse modifiedTime JSON for ${id}`, err);
          }
        }
      } else {
        console.warn(`Request for modifiedTime resulted in unknown response status ${status}`);
      }
    }
    return result;
  }

  static getLH4Params(height: number | undefined, jpgQuality: number): string {
    // https://gist.github.com/Sauerstoffdioxid/2a0206da9f44dde1fdfce290f38d2703
    const params = [...(height !== undefined ? [`h${height}`] : []), ...(jpgQuality < 100 ? ["rj", `l${jpgQuality}`] : [])];
    return params.length > 0 ? `=${params.join("-")}` : "";
  }

  static getImageURL(imageIdentifier: string, height: number | undefined, jpgQuality: number): string {
    return `https://lh4.googleusercontent.com/d/${imageIdentifier}${this.getLH4Params(height, jpgQuality)}`;
  }
}
