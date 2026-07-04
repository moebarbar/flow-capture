import { describe, it, expect } from "vitest";
import { getAppBaseUrl } from "../server/config";

describe("getAppBaseUrl", () => {
  it("derives an https origin from the request host when x-forwarded-proto=https", () => {
    const req = {
      headers: { "x-forwarded-proto": "https" },
      get: (h: string) => (h === "host" ? "app.example.com" : undefined),
    };
    expect(getAppBaseUrl(req)).toBe("https://app.example.com");
  });

  it("derives an http origin for a plain request", () => {
    const req = {
      headers: {},
      get: (h: string) => (h === "host" ? "localhost:5000" : undefined),
    };
    expect(getAppBaseUrl(req)).toBe("http://localhost:5000");
  });

  it("falls back to localhost when there is no request", () => {
    expect(getAppBaseUrl()).toMatch(/^http:\/\/localhost:\d+$/);
  });
});
