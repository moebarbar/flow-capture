/**
 * Convert a redaction region (percentages of the image) into a pixel rectangle
 * clamped to the image bounds. Pure function so it's unit-testable independently
 * of sharp / the database.
 */
export interface PercentRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function regionToPixelRect(
  region: PercentRegion,
  imageWidth: number,
  imageHeight: number
): PixelRect {
  const left = Math.max(0, Math.min(imageWidth - 1, Math.round((region.x / 100) * imageWidth)));
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round((region.y / 100) * imageHeight)));
  const width = Math.max(1, Math.min(imageWidth - left, Math.round((region.width / 100) * imageWidth)));
  const height = Math.max(1, Math.min(imageHeight - top, Math.round((region.height / 100) * imageHeight)));
  return { left, top, width, height };
}
