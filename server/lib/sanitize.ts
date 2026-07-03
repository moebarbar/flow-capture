import sanitizeHtml from "sanitize-html";

/**
 * Sanitize user-authored rich HTML (KB articles, content pages, blog posts).
 * Allows common formatting + images/links but strips scripts, event handlers,
 * and dangerous URL schemes. Single source of truth so no write path drifts.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height"],
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Disallow data: URIs (SVG/HTML data URIs are an XSS vector)
    allowProtocolRelative: false,
  });
}
