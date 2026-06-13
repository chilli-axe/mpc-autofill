import { ImageNotFoundError } from "../error";

export class GoogleDriveService {
  accessToken: string | undefined;

  async refreshAccessToken(env: Env): Promise<void> {
    if (this.accessToken !== undefined) {
      return;
    }

    if ((env.GOOGLE_CLIENT_ID ?? "") === "") {
      throw new Error("GOOGLE_CLIENT_ID not defined!");
    }
    if ((env.GOOGLE_CLIENT_SECRET ?? "") === "") {
      throw new Error("GOOGLE_CLIENT_SECRET not defined!");
    }
    if ((env.GOOGLE_REFRESH_TOKEN ?? "") === "") {
      throw new Error("GOOGLE_REFRESH_TOKEN not defined!");
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

  async getModifiedTime(identifier: string): Promise<Date | undefined> {
    if (this.accessToken === undefined) {
      throw new Error("GoogleDrive accessToken undefined");
    }
    const params = new URLSearchParams({
      driveId: identifier,
      fields: "name, modifiedTime",
    });

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${identifier}?${params}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      method: "GET",
    });

    if (response.status !== 200) {
      const responseStatusWas404 = response.status === 404;
      response.body?.cancel();
      if (responseStatusWas404) {
        throw new ImageNotFoundError(`Image ${identifier} not found`);
      }
    }

    const responseJson = await response.json<{ modifiedTime: string }>();
    const googleDriveTime = new Date(responseJson.modifiedTime);
    return googleDriveTime;

    // if (response.status !== 200) {
    //   const responseStatusWas404 = response.status === 404;
    //   response.body?.cancel();
    //   console.log(`Received response code ${response.status} when querying modifiedTime for ${identifier}`, response.body);
    //   if (responseStatusWas404) {
    //     console.log(`Removing ${identifier} from system following 404...`);
    //     for (const size of ["small", "large"] as Array<ImageSize>) {
    //       const imageKey = getImageKey("google_drive", size, identifier);
    //       await env.thumbnails.delete(imageKey);
    //     }
    //     console.log(`Removed ${identifier} from system.`);
    //   }
    //   return false;
    // }
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
