import { lookup } from "dns/promises";
import net from "net";

/**
 * SSRF protection for server-side fetches of user-supplied URLs (webhooks,
 * automation actions, remote images). Rejects non-http(s) schemes and any URL
 * that resolves to a private, loopback, link-local, or otherwise internal IP.
 */

function isPrivateIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true; // 10.0.0.0/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 169 && p[1] === 254) return true; // link-local incl. 169.254.169.254 metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    return false;
  }
  if (type === 6) {
    const norm = ip.toLowerCase();
    if (norm === "::1" || norm === "::") return true; // loopback / unspecified
    if (norm.startsWith("fe80")) return true; // link-local
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique local fc00::/7
    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    const mapped = norm.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

/**
 * Validate a user-supplied URL for server-side fetching.
 * Throws SsrfError if unsafe. Resolves DNS and checks every returned address.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SsrfError(`Unsupported URL scheme: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // If the host is already a literal IP, check it directly
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SsrfError("URL resolves to a private/internal address");
    }
    return url;
  }

  // Block obvious localhost aliases before DNS
  if (["localhost", "localhost.localdomain"].includes(hostname.toLowerCase())) {
    throw new SsrfError("URL resolves to a private/internal address");
  }

  // Resolve DNS and reject if ANY address is internal (defends against rebinding)
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfError("Could not resolve host");
  }
  if (addresses.length === 0) {
    throw new SsrfError("Could not resolve host");
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new SsrfError("URL resolves to a private/internal address");
    }
  }

  return url;
}

/**
 * fetch() wrapper that validates the URL first and refuses to follow redirects
 * (a redirect could point at an internal address after the initial check).
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  await assertSafeUrl(rawUrl);
  return fetch(rawUrl, { ...init, redirect: "error" });
}
