const TARGET_ASPECT_RATIO = 16 / 9;
const MAX_WIDTH = 1440;
const MAX_HEIGHT = MAX_WIDTH / TARGET_ASPECT_RATIO;

interface NormalizeOptions {
  maxWidth?: number;
  aspectRatio?: number;
  backgroundColor?: string;
  useBlurredBackground?: boolean;
}

export async function normalizeScreenshot(
  file: File | Blob,
  options: NormalizeOptions = {}
): Promise<Blob> {
  const {
    maxWidth = MAX_WIDTH,
    aspectRatio = TARGET_ASPECT_RATIO,
    backgroundColor = '#1a1a1a',
    useBlurredBackground = true,
  } = options;

  const targetHeight = maxWidth / aspectRatio;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = maxWidth;
      canvas.height = targetHeight;

      if (useBlurredBackground) {
        drawBlurredBackground(ctx, img, maxWidth, targetHeight);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, maxWidth, targetHeight);
      }

      const scale = Math.min(
        maxWidth / img.width,
        targetHeight / img.height
      );
      
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      
      const x = (maxWidth - scaledWidth) / 2;
      const y = (targetHeight - scaledHeight) / 2;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;

      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/png',
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  tempCanvas.width = width;
  tempCanvas.height = height;

  const scale = Math.max(width / img.width, height / img.height);
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;
  const x = (width - scaledWidth) / 2;
  const y = (height - scaledHeight) / 2;

  tempCtx.drawImage(img, x, y, scaledWidth, scaledHeight);

  ctx.filter = 'blur(30px) brightness(0.3) saturate(1.5)';
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.filter = 'none';

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url: string) {
  URL.revokeObjectURL(url);
}
