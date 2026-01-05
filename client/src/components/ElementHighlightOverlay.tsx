import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ElementBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface ElementHighlightOverlayProps {
  elementBounds?: ElementBounds | null;
  borderColor?: string;
  isElementCapture?: boolean;
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
}

export function ElementHighlightOverlay({
  elementBounds,
  borderColor = "#ef4444",
  isElementCapture,
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight,
}: ElementHighlightOverlayProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<"initial" | "highlight" | "zoom" | "done">("initial");

  useEffect(() => {
    if (isElementCapture && elementBounds) {
      setShowAnimation(true);
      setAnimationPhase("initial");

      const timer1 = setTimeout(() => setAnimationPhase("highlight"), 300);
      const timer2 = setTimeout(() => setAnimationPhase("zoom"), 1000);
      const timer3 = setTimeout(() => setAnimationPhase("done"), 2500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isElementCapture, elementBounds]);

  if (!isElementCapture || !elementBounds || !showAnimation) {
    return null;
  }

  const scaleX = containerWidth / elementBounds.viewportWidth;
  const scaleY = containerHeight / elementBounds.viewportHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (containerWidth - elementBounds.viewportWidth * scale) / 2;
  const offsetY = (containerHeight - elementBounds.viewportHeight * scale) / 2;

  const scaledLeft = elementBounds.left * scale + offsetX;
  const scaledTop = elementBounds.top * scale + offsetY;
  const scaledWidth = elementBounds.width * scale;
  const scaledHeight = elementBounds.height * scale;

  const padding = 4;

  return (
    <AnimatePresence>
      {animationPhase !== "done" && (
        <>
          <motion.div
            className="absolute pointer-events-none"
            style={{
              left: scaledLeft - padding,
              top: scaledTop - padding,
              width: scaledWidth + padding * 2,
              height: scaledHeight + padding * 2,
              borderWidth: 3,
              borderStyle: "solid",
              borderColor: borderColor,
              borderRadius: 6,
              boxShadow: `0 0 0 4px ${borderColor}40, 0 0 20px ${borderColor}60`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: animationPhase === "initial" ? 0 : 1,
              scale: animationPhase === "zoom" ? 1.05 : 1,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            data-testid="element-highlight-border"
          />

          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at ${scaledLeft + scaledWidth / 2}px ${scaledTop + scaledHeight / 2}px, transparent ${Math.max(scaledWidth, scaledHeight)}px, rgba(0,0,0,0.5) ${Math.max(scaledWidth, scaledHeight) * 2}px)`,
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: animationPhase === "zoom" ? 0.6 : 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            data-testid="element-highlight-vignette"
          />

          {animationPhase === "highlight" && (
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: scaledLeft - padding - 10,
                top: scaledTop - 30,
                backgroundColor: borderColor,
                color: "white",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              data-testid="element-highlight-label"
            >
              Element Captured
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

export function ElementZoomAnimation({
  elementBounds,
  borderColor = "#ef4444",
  isElementCapture,
}: {
  elementBounds?: ElementBounds | null;
  borderColor?: string;
  isElementCapture?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "zoom-in" | "hold" | "zoom-out">("idle");

  useEffect(() => {
    if (!isElementCapture || !elementBounds) {
      setPhase("idle");
      return;
    }

    setPhase("zoom-in");
    const timer1 = setTimeout(() => setPhase("hold"), 800);
    const timer2 = setTimeout(() => setPhase("zoom-out"), 2000);
    const timer3 = setTimeout(() => setPhase("idle"), 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isElementCapture, elementBounds]);

  if (!isElementCapture || !elementBounds || phase === "idle") {
    return null;
  }

  const centerX = elementBounds.left + elementBounds.width / 2;
  const centerY = elementBounds.top + elementBounds.height / 2;
  const viewportCenterX = elementBounds.viewportWidth / 2;
  const viewportCenterY = elementBounds.viewportHeight / 2;

  const translateX = viewportCenterX - centerX;
  const translateY = viewportCenterY - centerY;

  const zoomScale = Math.min(
    elementBounds.viewportWidth / (elementBounds.width * 2),
    elementBounds.viewportHeight / (elementBounds.height * 2),
    3
  );

  const getTransform = () => {
    switch (phase) {
      case "zoom-in":
        return {
          scale: zoomScale,
          x: translateX * zoomScale,
          y: translateY * zoomScale,
        };
      case "hold":
        return {
          scale: zoomScale,
          x: translateX * zoomScale,
          y: translateY * zoomScale,
        };
      case "zoom-out":
        return { scale: 1, x: 0, y: 0 };
      default:
        return { scale: 1, x: 0, y: 0 };
    }
  };

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-10"
      initial={{ scale: 1, x: 0, y: 0 }}
      animate={getTransform()}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      data-testid="element-zoom-container"
    >
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: `${(elementBounds.left / elementBounds.viewportWidth) * 100}%`,
          top: `${(elementBounds.top / elementBounds.viewportHeight) * 100}%`,
          width: `${(elementBounds.width / elementBounds.viewportWidth) * 100}%`,
          height: `${(elementBounds.height / elementBounds.viewportHeight) * 100}%`,
          borderWidth: 3,
          borderStyle: "solid",
          borderColor: borderColor,
          borderRadius: 6,
          boxShadow: `0 0 0 4000px rgba(0,0,0,0.4), 0 0 0 4px ${borderColor}40, 0 0 30px ${borderColor}80`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        data-testid="element-zoom-highlight"
      />
    </motion.div>
  );
}
