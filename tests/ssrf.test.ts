import { describe, it, expect } from "vitest";
import { assertSafeUrl, SsrfError } from "../server/lib/ssrf";

describe("assertSafeUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertSafeUrl("ftp://example.com/x")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("gopher://x")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects invalid URLs", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks the cloud metadata endpoint", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks loopback and localhost", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("http://localhost:5432/")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("http://[::1]/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks private IPv4 ranges", async () => {
    for (const ip of ["10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0"]) {
      await expect(assertSafeUrl(`http://${ip}/`), ip).rejects.toBeInstanceOf(SsrfError);
    }
  });

  it("blocks IPv4-mapped IPv6 to a private address", async () => {
    await expect(assertSafeUrl("http://[::ffff:10.0.0.1]/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks IPv6 unique-local and link-local", async () => {
    await expect(assertSafeUrl("http://[fc00::1]/")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeUrl("http://[fe80::1]/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("allows a public literal IP", async () => {
    const url = await assertSafeUrl("https://8.8.8.8/");
    expect(url.hostname).toBe("8.8.8.8");
  });
});
