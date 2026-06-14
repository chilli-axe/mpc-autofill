import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("worker routing", () => {
  it("responds with not found and proper status for /404", async () => {
    const response = await exports.default.fetch("http://example.com/404");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Unknown endpoint.");
  });
});
