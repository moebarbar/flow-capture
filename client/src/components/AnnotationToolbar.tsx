import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  Circle, Square, ArrowRight, Type, 
  Undo2, Trash2, MousePointer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type AnnotationTool = "select" | "callout" | "box" | "arrow" | "text";

export interface Annotation {
  id: string;
  type: AnnotationTool;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  endPosition?: { x: number; y: number };
  content?: string;
  number?: number;
  color: string;
}

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotations: Annotation[];
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  className?: string;
}

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  annotations,
  onUndo,
  onClear,
  canUndo,
  className,
}: AnnotationToolbarProps) {
  const tools: { id: AnnotationTool; icon: typeof Circle; label: string; shortcut: string }[] = [
    { id: "select", icon: MousePointer, label: "Select", shortcut: "V" },
    { id: "callout", icon: Circle, label: "Callout", shortcut: "C" },
    { id: "box", icon: Square, label: "Box", shortcut: "B" },
    { id: "arrow", icon: ArrowRight, label: "Arrow", shortcut: "A" },
    { id: "text", icon: Type, label: "Text", shortcut: "T" },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 bg-background border rounded-lg shadow-sm",
        className
      )}
      data-testid="annotation-toolbar"
    >
      {tools.map((tool) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === tool.id ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9"
              onClick={() => onToolChange(tool.id)}
              data-testid={`tool-${tool.id}`}
            >
              <tool.icon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {tool.label} ({tool.shortcut})
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="w-px h-6 bg-border mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onClear}
            disabled={annotations.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear all</TooltipContent>
      </Tooltip>

      {annotations.length > 0 && (
        <span className="text-xs text-muted-foreground ml-2">
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  annotations: Annotation[];
  activeTool: AnnotationTool;
  selectedId: string | null;
  onAnnotationAdd: (annotation: Omit<Annotation, "id">) => void;
  onAnnotationUpdate: (id: string, updates: Partial<Annotation>) => void;
  onAnnotationSelect: (id: string | null) => void;
  primaryColor?: string;
  className?: string;
}

export function AnnotationCanvas({
  width,
  height,
  annotations,
  activeTool,
  selectedId,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationSelect,
  primaryColor = "#3b82f6",
  className,
}: AnnotationCanvasProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentDraw, setCurrentDraw] = useState<Partial<Annotation> | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const getNextCalloutNumber = useCallback(() => {
    const callouts = annotations.filter(a => a.type === "callout");
    return callouts.length + 1;
  }, [annotations]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === "select") return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "callout") {
      onAnnotationAdd({
        type: "callout",
        position: { x, y },
        number: getNextCalloutNumber(),
        color: primaryColor,
      });
      return;
    }

    if (activeTool === "text") {
      const newId = `ann_${Date.now()}`;
      onAnnotationAdd({
        type: "text",
        position: { x, y },
        content: "",
        color: primaryColor,
      });
      setTimeout(() => setEditingTextId(newId), 0);
      return;
    }

    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentDraw({
      type: activeTool,
      position: { x, y },
      color: primaryColor,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !currentDraw) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "box") {
      setCurrentDraw({
        ...currentDraw,
        size: {
          width: Math.abs(x - drawStart.x),
          height: Math.abs(y - drawStart.y),
        },
        position: {
          x: Math.min(drawStart.x, x),
          y: Math.min(drawStart.y, y),
        },
      });
    } else if (activeTool === "arrow") {
      setCurrentDraw({
        ...currentDraw,
        endPosition: { x, y },
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDraw) {
      if (activeTool === "box" && currentDraw.size && currentDraw.size.width > 10 && currentDraw.size.height > 10) {
        onAnnotationAdd(currentDraw as Omit<Annotation, "id">);
      } else if (activeTool === "arrow" && currentDraw.endPosition) {
        const dx = currentDraw.endPosition.x - drawStart.x;
        const dy = currentDraw.endPosition.y - drawStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > 20) {
          onAnnotationAdd(currentDraw as Omit<Annotation, "id">);
        }
      }
    }
    setIsDrawing(false);
    setCurrentDraw(null);
  };

  const renderAnnotation = (annotation: Annotation) => {
    const isSelected = annotation.id === selectedId;

    switch (annotation.type) {
      case "callout":
        return (
          <g
            key={annotation.id}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationSelect(annotation.id);
            }}
            className="cursor-pointer"
          >
            <circle
              cx={annotation.position.x}
              cy={annotation.position.y}
              r={16}
              fill={annotation.color}
              stroke={isSelected ? "#fff" : "none"}
              strokeWidth={2}
            />
            <text
              x={annotation.position.x}
              y={annotation.position.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fff"
              fontSize={12}
              fontWeight={600}
            >
              {annotation.number}
            </text>
          </g>
        );

      case "box":
        return annotation.size ? (
          <rect
            key={annotation.id}
            x={annotation.position.x}
            y={annotation.position.y}
            width={annotation.size.width}
            height={annotation.size.height}
            fill={`${annotation.color}1a`}
            stroke={annotation.color}
            strokeWidth={2}
            rx={4}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationSelect(annotation.id);
            }}
            className="cursor-pointer"
          />
        ) : null;

      case "arrow":
        if (!annotation.endPosition) return null;
        const dx = annotation.endPosition.x - annotation.position.x;
        const dy = annotation.endPosition.y - annotation.position.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const arrowSize = 10;
        const arrowX = annotation.endPosition.x - arrowSize * Math.cos(angle);
        const arrowY = annotation.endPosition.y - arrowSize * Math.sin(angle);

        return (
          <g
            key={annotation.id}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationSelect(annotation.id);
            }}
            className="cursor-pointer"
          >
            <line
              x1={annotation.position.x}
              y1={annotation.position.y}
              x2={annotation.endPosition.x}
              y2={annotation.endPosition.y}
              stroke={annotation.color}
              strokeWidth={2}
            />
            <polygon
              points={`
                ${annotation.endPosition.x},${annotation.endPosition.y}
                ${arrowX - arrowSize * 0.5 * Math.cos(angle - Math.PI / 2)},${arrowY - arrowSize * 0.5 * Math.sin(angle - Math.PI / 2)}
                ${arrowX + arrowSize * 0.5 * Math.cos(angle - Math.PI / 2)},${arrowY + arrowSize * 0.5 * Math.sin(angle - Math.PI / 2)}
              `}
              fill={annotation.color}
            />
          </g>
        );

      case "text":
        return (
          <g
            key={annotation.id}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationSelect(annotation.id);
            }}
          >
            <rect
              x={annotation.position.x}
              y={annotation.position.y}
              width={Math.max(100, (annotation.content?.length || 10) * 7 + 24)}
              height={28}
              rx={6}
              fill="rgba(0,0,0,0.75)"
            />
            {editingTextId === annotation.id ? (
              <foreignObject
                x={annotation.position.x + 12}
                y={annotation.position.y + 4}
                width={200}
                height={20}
              >
                <input
                  type="text"
                  autoFocus
                  defaultValue={annotation.content}
                  onBlur={(e) => {
                    onAnnotationUpdate(annotation.id, { content: e.target.value });
                    setEditingTextId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onAnnotationUpdate(annotation.id, { content: e.currentTarget.value });
                      setEditingTextId(null);
                    }
                  }}
                  className="bg-transparent text-white text-sm outline-none w-full"
                  style={{ fontSize: 14 }}
                />
              </foreignObject>
            ) : (
              <text
                x={annotation.position.x + 12}
                y={annotation.position.y + 18}
                fill="#fff"
                fontSize={14}
                onDoubleClick={() => setEditingTextId(annotation.id)}
                className="cursor-text"
              >
                {annotation.content || "Click to edit"}
              </text>
            )}
          </g>
        );

      default:
        return null;
    }
  };

  const renderCurrentDraw = () => {
    if (!currentDraw) return null;

    if (currentDraw.type === "box" && currentDraw.size) {
      return (
        <rect
          x={currentDraw.position?.x}
          y={currentDraw.position?.y}
          width={currentDraw.size.width}
          height={currentDraw.size.height}
          fill={`${primaryColor}1a`}
          stroke={primaryColor}
          strokeWidth={2}
          strokeDasharray="4"
          rx={4}
        />
      );
    }

    if (currentDraw.type === "arrow" && currentDraw.endPosition && currentDraw.position) {
      return (
        <line
          x1={currentDraw.position.x}
          y1={currentDraw.position.y}
          x2={currentDraw.endPosition.x}
          y2={currentDraw.endPosition.y}
          stroke={primaryColor}
          strokeWidth={2}
          strokeDasharray="4"
        />
      );
    }

    return null;
  };

  return (
    <svg
      width={width}
      height={height}
      className={cn("absolute inset-0", className)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => onAnnotationSelect(null)}
      style={{
        cursor:
          activeTool === "select"
            ? "default"
            : activeTool === "callout"
            ? "crosshair"
            : activeTool === "text"
            ? "text"
            : "crosshair",
      }}
    >
      {annotations.map(renderAnnotation)}
      {renderCurrentDraw()}
    </svg>
  );
}

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addAnnotation = useCallback((annotation: Omit<Annotation, "id">) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    setAnnotations((prev) => {
      const newAnnotations = [...prev, newAnnotation];
      setHistory((h) => [...h.slice(0, historyIndex + 1), newAnnotations]);
      setHistoryIndex((i) => i + 1);
      return newAnnotations;
    });
  }, [historyIndex]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) => {
      const newAnnotations = prev.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      );
      setHistory((h) => [...h.slice(0, historyIndex + 1), newAnnotations]);
      setHistoryIndex((i) => i + 1);
      return newAnnotations;
    });
  }, [historyIndex]);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const newAnnotations = prev.filter((a) => a.id !== id);
      setHistory((h) => [...h.slice(0, historyIndex + 1), newAnnotations]);
      setHistoryIndex((i) => i + 1);
      return newAnnotations;
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1);
      setAnnotations(history[historyIndex - 1]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setAnnotations([]);
    }
  }, [historyIndex, history]);

  const clear = useCallback(() => {
    setHistory((h) => [...h.slice(0, historyIndex + 1), []]);
    setHistoryIndex((i) => i + 1);
    setAnnotations([]);
  }, [historyIndex]);

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    undo,
    clear,
    canUndo: historyIndex >= 0,
  };
}
