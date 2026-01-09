import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  X, Copy, ExternalLink, AlertTriangle, CheckCircle, 
  ChevronDown, ChevronRight, Info, Eye, EyeOff, Lock,
  Code, Target, Clock, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

export interface ElementSelector {
  type: "primary" | "fallback" | "backup";
  selector: string;
  quality: "stable" | "good" | "backup";
  description?: string;
}

export interface ElementRisk {
  severity: "high" | "moderate" | "low";
  title: string;
  description: string;
  recommendation?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ElementVisibility {
  wasVisible: boolean;
  wasInViewport: boolean;
  wasNotObscured: boolean;
  wasEnabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface ElementData {
  tagName: string;
  semanticDescription: string;
  role?: string;
  isInteractive: boolean;
  isFocusable: boolean;
  isVisible: boolean;
  selectors: ElementSelector[];
  qualityScore: number;
  visibility: ElementVisibility;
  pageUrl: string;
  pageTitle: string;
  capturedAt: Date;
  risks: ElementRisk[];
  attributes: Record<string, string>;
}

interface ElementIntelligencePanelProps {
  element: ElementData;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ElementIntelligencePanel({
  element,
  isOpen,
  onClose,
  className,
}: ElementIntelligencePanelProps) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    selectors: true,
    visibility: false,
    context: false,
    risks: true,
    attributes: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-blue-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Moderate";
    return "Weak";
  };

  return (
    <div
      className={cn(
        "w-96 bg-background border-l h-full overflow-y-auto",
        className
      )}
      data-testid="element-intelligence-panel"
    >
      <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold">Element Intelligence</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4 text-muted-foreground" />
            <code className="text-sm font-mono">&lt;{element.tagName.toLowerCase()}&gt;</code>
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            {element.semanticDescription}
          </div>
          <div className="flex flex-wrap gap-2">
            {element.role && (
              <Badge variant="secondary" className="text-xs">
                Role: {element.role}
              </Badge>
            )}
            <Badge variant={element.isInteractive ? "default" : "secondary"} className="text-xs">
              {element.isInteractive ? "Interactive" : "Static"}
            </Badge>
            <Badge variant={element.isVisible ? "default" : "secondary"} className="text-xs">
              {element.isVisible ? "Visible" : "Hidden"}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <button
            onClick={() => toggleSection("selectors")}
            className="w-full flex items-center justify-between p-3 bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Selector Quality</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-bold", getScoreColor(element.qualityScore))}>
                {element.qualityScore}/100
              </span>
              {expandedSections.selectors ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </button>

          {expandedSections.selectors && (
            <div className="p-3 border-t space-y-3">
              <div>
                <Progress value={element.qualityScore} className="h-2" />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {getScoreLabel(element.qualityScore)}
                  </span>
                </div>
              </div>

              {element.selectors.map((sel, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {sel.type}
                    </span>
                    <Badge 
                      variant={sel.quality === "stable" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {sel.quality === "stable" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {sel.quality}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-muted p-2 rounded truncate">
                      {sel.selector}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => copyToClipboard(sel.selector, "Selector")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  {sel.description && (
                    <p className="text-xs text-muted-foreground">{sel.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden">
          <button
            onClick={() => toggleSection("visibility")}
            className="w-full flex items-center justify-between p-3 bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Visibility Status</span>
            </div>
            {expandedSections.visibility ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {expandedSections.visibility && (
            <div className="p-3 border-t space-y-2">
              {[
                { check: element.visibility.wasVisible, label: "Element was visible" },
                { check: element.visibility.wasInViewport, label: "Element was in viewport" },
                { check: element.visibility.wasNotObscured, label: "Element was not obscured" },
                { check: element.visibility.wasEnabled, label: "Element was enabled" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {item.check ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
              <div className="pt-2 border-t mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-mono">
                    ({element.visibility.position.x}, {element.visibility.position.y})
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-mono">
                    {element.visibility.size.width} × {element.visibility.size.height}px
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden">
          <button
            onClick={() => toggleSection("context")}
            className="w-full flex items-center justify-between p-3 bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Page Context</span>
            </div>
            {expandedSections.context ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {expandedSections.context && (
            <div className="p-3 border-t space-y-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground">URL</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs font-mono bg-muted p-2 rounded truncate">
                    {element.pageUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => copyToClipboard(element.pageUrl, "URL")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">Page Title</span>
                <p className="text-sm mt-1">{element.pageTitle}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">Captured</span>
                <p className="text-sm mt-1">
                  {element.capturedAt.toLocaleDateString()} at{" "}
                  {element.capturedAt.toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {element.risks.length > 0 && (
          <div className="rounded-lg border overflow-hidden border-yellow-500/50">
            <button
              onClick={() => toggleSection("risks")}
              className="w-full flex items-center justify-between p-3 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="font-medium text-sm">Potential Risks</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {element.risks.length}
                </Badge>
                {expandedSections.risks ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </button>

            {expandedSections.risks && (
              <div className="p-3 border-t space-y-3">
                {element.risks.map((risk, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border",
                      risk.severity === "high" && "border-red-500/50 bg-red-500/5",
                      risk.severity === "moderate" && "border-yellow-500/50 bg-yellow-500/5",
                      risk.severity === "low" && "border-blue-500/50 bg-blue-500/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={cn(
                          "w-4 h-4 mt-0.5",
                          risk.severity === "high" && "text-red-500",
                          risk.severity === "moderate" && "text-yellow-500",
                          risk.severity === "low" && "text-blue-500"
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{risk.title}</span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              risk.severity === "high" && "text-red-500",
                              risk.severity === "moderate" && "text-yellow-500",
                              risk.severity === "low" && "text-blue-500"
                            )}
                          >
                            {risk.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {risk.description}
                        </p>
                        {risk.recommendation && (
                          <p className="text-xs mt-2">
                            <span className="font-medium">Recommendation: </span>
                            {risk.recommendation}
                          </p>
                        )}
                        {risk.action && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={risk.action.onClick}
                          >
                            {risk.action.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <button
            onClick={() => toggleSection("attributes")}
            className="w-full flex items-center justify-between p-3 bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Raw Attributes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {Object.keys(element.attributes).length}
              </span>
              {expandedSections.attributes ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </button>

          {expandedSections.attributes && (
            <div className="p-3 border-t">
              <div className="space-y-1 font-mono text-xs">
                {Object.entries(element.attributes).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground w-24 flex-shrink-0 truncate">
                      {key}
                    </span>
                    <span className="truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ElementInfoButtonProps {
  hasRisks?: boolean;
  onClick: () => void;
  className?: string;
}

export function ElementInfoButton({ hasRisks, onClick, className }: ElementInfoButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent",
            className
          )}
        >
          {hasRisks ? (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          ) : (
            <Info className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {hasRisks ? "View element risks" : "View element details"}
      </TooltipContent>
    </Tooltip>
  );
}
