import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, Loader2, AlertTriangle, Cloud, CloudOff, 
  ChevronDown, ChevronUp, RefreshCw, X, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type SyncState = "synced" | "syncing" | "pending" | "error" | "offline";

export interface PendingItem {
  id: string;
  type: "step" | "screenshot";
  stepNumber: number;
  progress?: number;
  size?: string;
  error?: string;
}

export interface StepSyncStatus {
  stepId: number;
  state: SyncState;
  lastSynced?: Date;
  error?: string;
}

interface SyncStatusIndicatorProps {
  state: SyncState;
  pendingItems?: PendingItem[];
  lastSynced?: Date;
  onRetry?: () => void;
  onExport?: () => void;
  className?: string;
}

export function SyncStatusIndicator({
  state,
  pendingItems = [],
  lastSynced,
  onRetry,
  onExport,
  className,
}: SyncStatusIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  const formatLastSynced = () => {
    if (!lastSynced) return "";
    const diff = Date.now() - lastSynced.getTime();
    if (diff < 5000) return "Just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return lastSynced.toLocaleTimeString();
  };

  const pendingCount = pendingItems.length;
  const failedItems = pendingItems.filter(i => i.error);

  return (
    <div className={cn("border-t bg-card", className)} data-testid="sync-status">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {state === "synced" && (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">All changes saved</span>
            </>
          )}
          {state === "syncing" && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm">Saving changes...</span>
            </>
          )}
          {state === "pending" && (
            <>
              <Cloud className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Changes waiting to sync</span>
            </>
          )}
          {state === "error" && (
            <>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-500">Some changes couldn't save</span>
            </>
          )}
          {state === "offline" && (
            <>
              <CloudOff className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Offline · Saved locally</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && state !== "synced" && (
            <span className="text-xs text-muted-foreground">{pendingCount} pending</span>
          )}
          {state === "synced" && lastSynced && (
            <span className="text-xs text-muted-foreground">{formatLastSynced()}</span>
          )}
          {pendingCount > 0 && (
            expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </div>
      </button>

      {expanded && pendingCount > 0 && (
        <div className="px-3 pb-3 space-y-2">
          <div className="max-h-40 overflow-y-auto space-y-2">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md text-sm",
                  item.error ? "bg-red-500/10" : "bg-muted/50"
                )}
              >
                {item.error ? (
                  <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                ) : item.progress !== undefined ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500 flex-shrink-0" />
                ) : (
                  <Cloud className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">
                    Step {item.stepNumber} {item.type}
                  </div>
                  {item.progress !== undefined && (
                    <Progress value={item.progress} className="h-1 mt-1" />
                  )}
                  {item.error && (
                    <div className="text-xs text-red-500 truncate">{item.error}</div>
                  )}
                </div>
                {item.size && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {item.size}
                  </span>
                )}
              </div>
            ))}
          </div>

          {failedItems.length > 0 && (
            <div className="flex gap-2 pt-2">
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="flex-1">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry All
                </Button>
              )}
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport} className="flex-1">
                  <Download className="w-3 h-3 mr-1" />
                  Export Locally
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StepSyncBadgeProps {
  state: SyncState;
  onRetry?: () => void;
  className?: string;
}

export function StepSyncBadge({ state, onRetry, className }: StepSyncBadgeProps) {
  if (state === "synced") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", className)}>
            <CheckCircle className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Saved</TooltipContent>
      </Tooltip>
    );
  }

  if (state === "syncing") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", className)}>
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Saving...</TooltipContent>
      </Tooltip>
    );
  }

  if (state === "pending") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", className)}>
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Unsaved</TooltipContent>
      </Tooltip>
    );
  }

  if (state === "error") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onRetry}
            className={cn("flex items-center hover:opacity-80", className)}
          >
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-2">
            <span>Couldn't save</span>
            {onRetry && <span className="text-xs">· Click to retry</span>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (state === "offline") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", className)}>
            <div className="w-2 h-2 rounded-full border border-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Saved locally</TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
