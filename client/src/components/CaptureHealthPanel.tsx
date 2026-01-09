import { cn } from "@/lib/utils";
import { 
  CheckCircle, AlertTriangle, XCircle, Wifi, WifiOff, 
  Camera, Cloud, RefreshCw, X, ChevronDown, ChevronUp 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { CaptureHealth, HealthStatus } from "./RecordingIndicator";

interface HealthItemProps {
  label: string;
  status: HealthStatus;
  details?: string[];
  metric?: string;
}

function HealthItem({ label, status, details = [], metric }: HealthItemProps) {
  const statusIcons = {
    healthy: <CheckCircle className="w-4 h-4 text-green-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    offline: <WifiOff className="w-4 h-4 text-muted-foreground" />,
  };

  const statusLabels = {
    healthy: "Connected",
    warning: "Warning",
    error: "Error",
    offline: "Offline",
  };

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {statusIcons[status]}
          <span className={cn(
            "text-xs font-medium",
            status === "healthy" && "text-green-500",
            status === "warning" && "text-yellow-500",
            status === "error" && "text-red-500",
            status === "offline" && "text-muted-foreground"
          )}>
            {statusLabels[status]}
          </span>
        </div>
      </div>
      {details.length > 0 && (
        <div className="space-y-1">
          {details.map((detail, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>{detail}</span>
            </div>
          ))}
        </div>
      )}
      {metric && (
        <div className="mt-2 text-xs text-muted-foreground">{metric}</div>
      )}
    </div>
  );
}

interface CaptureHealthPanelProps {
  health: CaptureHealth;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  className?: string;
}

export function CaptureHealthPanel({
  health,
  isOpen,
  onClose,
  onRetry,
  className,
}: CaptureHealthPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (!isOpen) return null;

  const getOverallMessage = () => {
    const statuses = [health.connection, health.screenshots, health.network, health.sync];
    if (statuses.every(s => s === "healthy")) {
      return "Everything is working correctly.";
    }
    if (statuses.includes("error")) {
      return "Some systems need attention.";
    }
    if (statuses.includes("warning")) {
      return "Some systems are experiencing issues.";
    }
    if (statuses.includes("offline")) {
      return "You're offline. Work is saved locally.";
    }
    return "";
  };

  return (
    <div
      className={cn(
        "fixed top-20 right-4 w-80 bg-background border rounded-lg shadow-xl z-50",
        className
      )}
      data-testid="capture-health-panel"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">System Health</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <HealthItem
            label="Capture"
            status={health.connection}
            details={
              health.connection === "healthy"
                ? ["Extension active", "Page connection working", "Tracking user actions"]
                : health.connection === "error"
                ? ["Connection lost"]
                : []
            }
            metric={health.connection === "healthy" ? "Last action captured: Just now" : undefined}
          />

          <HealthItem
            label="Screenshots"
            status={health.screenshots}
            details={
              health.screenshots === "healthy"
                ? ["Permission granted", "Capture available"]
                : health.screenshots === "warning"
                ? ["Captures taking longer"]
                : health.screenshots === "error"
                ? ["Cannot capture screenshots"]
                : []
            }
          />

          <HealthItem
            label="Network"
            status={health.network}
            details={
              health.network === "healthy"
                ? ["Internet connected", "Server reachable"]
                : health.network === "offline"
                ? ["No internet connection"]
                : health.network === "error"
                ? ["Server not responding"]
                : []
            }
            metric={health.network === "healthy" ? "Response time: 89ms" : undefined}
          />

          <HealthItem
            label="Sync"
            status={health.sync}
            details={
              health.sync === "healthy"
                ? ["All steps saved", "No pending changes"]
                : health.sync === "warning"
                ? [`${health.pendingSteps || 0} steps pending`]
                : health.sync === "error"
                ? ["Sync failed"]
                : []
            }
            metric={health.sync === "healthy" ? "Last sync: Just now" : undefined}
          />

          <div className="pt-2 text-sm text-muted-foreground">
            {getOverallMessage()}
          </div>

          {(health.connection === "error" || health.sync === "error") && onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onRetry}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
