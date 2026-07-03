import { useEffect, useRef, useState, useCallback } from "react";
import {
  AnnotationToolbar,
  AnnotationCanvas,
  type Annotation,
  type AnnotationTool,
} from "@/components/AnnotationToolbar";

/**
 * Wraps AnnotationToolbar + AnnotationCanvas around a step screenshot.
 *
 * Coordinates are stored NORMALIZED (0..1) relative to the DISPLAYED IMAGE box
 * (not the container). Because the image is object-contain — letterboxed inside
 * its container — we compute the contained image rect from the container size
 * and the image's natural dimensions, then map coordinates onto that rect. This
 * keeps annotations glued to image features across the editor, shared viewer,
 * and embed even though those containers differ in size and aspect ratio.
 */

interface StepAnnotatorProps {
  imageUrl: string;
  annotations: Annotation[]; // normalized (0..1) relative to the image
  editable?: boolean;
  onChange?: (annotations: Annotation[]) => void;
  className?: string;
  imgClassName?: string;
}

interface ImageRect {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

// The rectangle the image actually occupies inside its object-contain container.
function containedRect(cw: number, ch: number, nw: number, nh: number): ImageRect {
  if (!cw || !ch || !nw || !nh) return { offsetX: 0, offsetY: 0, width: cw, height: ch };
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { offsetX: (cw - width) / 2, offsetY: (ch - height) / 2, width, height };
}

export function StepAnnotator({
  imageUrl,
  annotations,
  editable = false,
  onChange,
  className,
  imgClassName,
}: StepAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainer({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = containedRect(container.w, container.h, natural.w, natural.h);
  const ready = rect.width > 0 && rect.height > 0;

  // normalized (image space) -> pixels (container space)
  const toPixels = (a: Annotation): Annotation => ({
    ...a,
    position: { x: rect.offsetX + a.position.x * rect.width, y: rect.offsetY + a.position.y * rect.height },
    size: a.size ? { width: a.size.width * rect.width, height: a.size.height * rect.height } : undefined,
    endPosition: a.endPosition
      ? { x: rect.offsetX + a.endPosition.x * rect.width, y: rect.offsetY + a.endPosition.y * rect.height }
      : undefined,
  });

  // pixels (container space) -> normalized (image space)
  const toNormalized = (a: Omit<Annotation, "id">): Omit<Annotation, "id"> => ({
    ...a,
    position: { x: (a.position.x - rect.offsetX) / rect.width, y: (a.position.y - rect.offsetY) / rect.height },
    size: a.size ? { width: a.size.width / rect.width, height: a.size.height / rect.height } : undefined,
    endPosition: a.endPosition
      ? { x: (a.endPosition.x - rect.offsetX) / rect.width, y: (a.endPosition.y - rect.offsetY) / rect.height }
      : undefined,
  });

  const pixelAnnotations = ready ? annotations.map(toPixels) : [];

  const handleAdd = useCallback(
    (a: Omit<Annotation, "id">) => {
      if (!onChange || !ready) return;
      const withId: Annotation = {
        ...toNormalized(a),
        id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      onChange([...annotations, withId]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, annotations, ready, rect.offsetX, rect.offsetY, rect.width, rect.height]
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<Annotation>) => {
      // AnnotationCanvas only sends text-content updates (no coordinate moves).
      onChange?.(annotations.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    },
    [onChange, annotations]
  );

  const handleUndo = useCallback(() => {
    if (annotations.length) onChange?.(annotations.slice(0, -1));
  }, [onChange, annotations]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className || ""}`}>
      <img
        src={imageUrl}
        alt="Step"
        className={imgClassName || "w-full h-full object-contain"}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {ready && (annotations.length > 0 || editable) && (
        <AnnotationCanvas
          width={container.w}
          height={container.h}
          annotations={pixelAnnotations}
          activeTool={editable ? activeTool : "select"}
          selectedId={selectedId}
          onAnnotationAdd={handleAdd}
          onAnnotationUpdate={handleUpdate}
          onAnnotationSelect={editable ? setSelectedId : () => {}}
          className={editable ? "" : "pointer-events-none"}
        />
      )}
      {editable && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40">
          <AnnotationToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            annotations={annotations}
            onUndo={handleUndo}
            onClear={() => onChange?.([])}
            canUndo={annotations.length > 0}
          />
        </div>
      )}
    </div>
  );
}
