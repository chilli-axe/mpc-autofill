import { describe, expect, it } from "vitest";

import { handleOptionsRequest } from "../../src/handler/cors";

describe("handleOptionsRequest", () => {
  it("returns preflight CORS headers when the browser sends access-control request headers", async () => {
    const response = await handleOptionsRequest(
      new Request("https://example.com/images/google_drive/small/image-id.jpg", {
        method: "OPTIONS",
        headers: {
          Origin: "https://mpcfill.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "X-Requested-With",
        },
      })
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,HEAD,POST,OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("X-Requested-With");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("returns an Allow header for standard OPTIONS requests", async () => {
    const response = await handleOptionsRequest(
      new Request("https://example.com/images/google_drive/small/image-id.jpg", { method: "OPTIONS" })
    );

    expect(response.headers.get("Allow")).toBe("GET, HEAD, POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
