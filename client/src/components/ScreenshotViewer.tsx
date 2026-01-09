import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw,
  Move, MousePointer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ElementBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenshotViewerProps {
  src: string;
  alt?: string;
  elementBox?: ElementBoundingBox;
  showElementHighlight?: boolean;
  onAnnotateClick?: () => void;
  isAnnotating?: boolean;
  className?: string;
}

export function ScreenshotViewer({
  src,
  alt = "Screenshot",
  elementBox,
  showElementHighlight = true,
  onAnnotateClick,
  isAnnotating = false,
  className,
}: ScreenshotViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const minZoom = 0.25;
  const maxZoom = 4;

  useEffect(() => {
    if (imageRef.current && imageRef.current.complete) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      setImageLoaded(true);
    }
  }, [src]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      setImageLoaded(true);
    }
  };

  const fitToContainer = useCallback(() => {
    if (!containerRef.current || !imageLoaded) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const scaleX = container.width / naturalSize.width;
    const scaleY = container.height / naturalSize.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    
    setZoom(fitZoom);
    setPosition({ x: 0, y: 0 });
  }, [imageLoaded, naturalSize]);

  useEffect(() => {
    fitToContainer();
  }, [fitToContainer]);

  const handleZoomChange = (newZoom: number) => {
    setZoom(Math.max(minZoom, Math.min(maxZoom, newZoom)));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      handleZoomChange(zoom + delta);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1 && !isAnnotating) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || isAnnotating) return;
    
    if (zoom < 1.5) {
      handleZoomChange(1.5);
    } else if (zoom < 2) {
      handleZoomChange(2);
    } else {
      fitToContainer();
    }
  };

  const focusOnElement = useCallback(() => {
    if (!elementBox || !containerRef.current || !imageLoaded) return;

    const container = containerRef.current.getBoundingClientRect();
    const targetFill = 0.6;

    const scaleX = (container.width * targetFill) / elementBox.width;
    const scaleY = (container.height * targetFill) / elementBox.height;
    const newZoom = Math.min(scaleX, scaleY, maxZoom);

    const elementCenterX = elementBox.x + elementBox.width / 2;
    const elementCenterY = elementBox.y + elementBox.height / 2;

    setZoom(newZoom);
    setPosition({
      x: container.width / 2 - elementCenterX * newZoom,
      y: container.height / 2 - elementCenterY * newZoom,
    });
  }, [elementBox, imageLoaded]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={cn(
        "relative bg-muted/50 rounded-lg overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
        className
      )}
      data-testid="screenshot-viewer"
    >
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden",
          isFullscreen ? "h-[calc(100%-48px)]" : "h-full min-h-[300px]",
          zoom > 1 && !isAnnotating && "cursor-grab",
          isDragging && "cursor-grabbing"
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        <div
          className="absolute transition-transform duration-200 ease-out origin-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transitionDuration: isDragging ? "0ms" : "200ms",
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onLoad={handleImageLoad}
            className="max-w-none"
            draggable={false}
          />

          {showElementHighlight && elementBox && (
            <div
              className="absolute border-2 border-blue-500 rounded pointer-events-none"
              style={{
                left: elementBox.x,
                top: elementBox.y,
                width: elementBox.width,
                height: elementBox.height,
                boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.2)",
              }}
            />
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2 bg-background/90 backdrop-blur-sm border-t">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={fitToContainer}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to view</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs font-mono"
                onClick={() => handleZoomChange(1)}
              >
                100%
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actual size</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2 w-32">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleZoomChange(zoom - 0.25)}
              disabled={zoom <= minZoom}
            >
              <ZoomOut className="w-3 h-3" />
            </Button>
            <Slider
              value={[zoom]}
              min={minZoom}
              max={maxZoom}
              step={0.1}
              onValueChange={([v]) => handleZoomChange(v)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleZoomChange(zoom + 0.25)}
              disabled={zoom >= maxZoom}
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>

          {elementBox && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={focusOnElement}
                >
                  <MousePointer className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Focus on element</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </TooltipContent>
          </Tooltip>

          {onAnnotateClick && (
            <Button
              variant={isAnnotating ? "default" : "outline"}
              size="sm"
              onClick={onAnnotateClick}
            >
              {isAnnotating ? "Done" : "Annotate"}
            </Button>
          )}
        </div>
      </div>

      <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
