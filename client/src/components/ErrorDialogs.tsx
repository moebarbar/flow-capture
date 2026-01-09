import { cn } from "@/lib/utils";
import { 
  AlertTriangle, XCircle, WifiOff, RefreshCw, 
  Download, HelpCircle, ExternalLink, X, Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export type ErrorType =
  | "capture_interrupted"
  | "connection_lost"
  | "extension_stopped"
  | "screenshot_blocked"
  | "screenshot_timeout"
  | "upload_failed"
  | "offline"
  | "server_down"
  | "session_expired"
  | "sync_failed";

interface ErrorDialogProps {
  type: ErrorType;
  isOpen: boolean;
  onClose: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  details?: {
    stepsCount?: number;
    pendingCount?: number;
    errorMessage?: string;
  };
}

const errorConfigs: Record<
  ErrorType,
  {
    icon: typeof AlertTriangle;
    iconColor: string;
    title: string;
    description: string;
    safetyMessage?: string;
    primaryLabel: string;
    secondaryLabel?: string;
  }
> = {
  capture_interrupted: {
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    title: "Capture Interrupted",
    description: "You left the page you were recording.",
    safetyMessage: "Your captured steps are safe.",
    primaryLabel: "Continue on New Page",
    secondaryLabel: "Finish Recording",
  },
  connection_lost: {
    icon: WifiOff,
    iconColor: "text-yellow-500",
    title: "Connection Lost",
    description: "We lost connection to the page. This usually happens after a page refresh.",
    safetyMessage: "Your captured steps are safe.",
    primaryLabel: "Reconnect Now",
    secondaryLabel: "Finish Recording",
  },
  extension_stopped: {
    icon: XCircle,
    iconColor: "text-red-500",
    title: "Extension Stopped",
    description: "The FlowCapture extension was disabled or stopped.",
    safetyMessage: "Your steps are saved locally.",
    primaryLabel: "Open Extension Settings",
    secondaryLabel: "Download Steps Locally",
  },
  screenshot_blocked: {
    icon: Camera,
    iconColor: "text-yellow-500",
    title: "Screenshot Blocked",
    description: "Chrome prevented us from capturing a screenshot. This happens on sensitive pages for your security.",
    safetyMessage: "Your step was captured without an image.",
    primaryLabel: "Continue Without Screenshots",
    secondaryLabel: "Add Image Manually Later",
  },
  screenshot_timeout: {
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    title: "Screenshot Slow",
    description: "This screenshot is taking longer than usual. The page may still be loading.",
    primaryLabel: "Wait Longer",
    secondaryLabel: "Skip This Screenshot",
  },
  upload_failed: {
    icon: AlertTriangle,
    iconColor: "text-red-500",
    title: "Upload Failed",
    description: "The screenshot is saved locally but couldn't upload to the cloud.",
    safetyMessage: "Your work is safe locally.",
    primaryLabel: "Retry Now",
    secondaryLabel: "Skip Upload",
  },
  offline: {
    icon: WifiOff,
    iconColor: "text-muted-foreground",
    title: "You're Offline",
    description: "Your internet connection was lost.",
    safetyMessage: "Capture continues working. Steps are saved on this device and will sync when you're back online.",
    primaryLabel: "Continue Offline",
    secondaryLabel: "Check Connection",
  },
  server_down: {
    icon: XCircle,
    iconColor: "text-red-500",
    title: "Server Unavailable",
    description: "We can't reach the FlowCapture server right now. Our team has been notified.",
    safetyMessage: "Your work is safe locally and will sync when the server is back.",
    primaryLabel: "Continue Working",
    secondaryLabel: "Check Status Page",
  },
  session_expired: {
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    title: "Session Expired",
    description: "You've been signed out. This can happen if you signed in on another device.",
    safetyMessage: "Your unsaved work will sync after you sign back in.",
    primaryLabel: "Sign In Again",
    secondaryLabel: "Save Work Locally First",
  },
  sync_failed: {
    icon: XCircle,
    iconColor: "text-red-500",
    title: "Sync Failed",
    description: "We tried multiple times but couldn't save your work to the server.",
    safetyMessage: "Your work is safe locally.",
    primaryLabel: "Retry Now",
    secondaryLabel: "Export Locally",
  },
};

export function ErrorDialog({
  type,
  isOpen,
  onClose,
  onPrimaryAction,
  onSecondaryAction,
  details,
}: ErrorDialogProps) {
  const config = errorConfigs[type];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid={`error-dialog-${type}`}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full bg-muted", config.iconColor)}>
              <Icon className="w-5 h-5" />
            </div>
            <DialogTitle>{config.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {config.description}
            {details?.errorMessage && (
              <span className="block mt-1 text-xs text-muted-foreground">
                Reason: {details.errorMessage}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {config.safetyMessage && (
          <Alert variant="default" className="bg-green-500/10 border-green-500/20">
            <AlertDescription className="text-sm">
              {config.safetyMessage}
              {details?.stepsCount !== undefined && (
                <span className="block mt-1 font-medium">
                  {details.stepsCount} steps captured
                </span>
              )}
              {details?.pendingCount !== undefined && details.pendingCount > 0 && (
                <span className="block mt-1">
                  {details.pendingCount} items waiting to sync
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {config.secondaryLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction} className="w-full sm:w-auto">
              {config.secondaryLabel}
            </Button>
          )}
          <Button onClick={onPrimaryAction || onClose} className="w-full sm:w-auto">
            {config.primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InlineErrorAlertProps {
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function InlineErrorAlert({
  type,
  title,
  description,
  action,
  onDismiss,
  className,
}: InlineErrorAlertProps) {
  const icons = {
    warning: AlertTriangle,
    error: XCircle,
    info: HelpCircle,
  };
  const Icon = icons[type];

  const colors = {
    warning: "border-yellow-500/50 bg-yellow-500/10",
    error: "border-red-500/50 bg-red-500/10",
    info: "border-blue-500/50 bg-blue-500/10",
  };

  const iconColors = {
    warning: "text-yellow-500",
    error: "text-red-500",
    info: "text-blue-500",
  };

  return (
    <div
      className={cn(
        "relative p-3 rounded-lg border",
        colors[type],
        className
      )}
      data-testid={`inline-alert-${type}`}
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="flex gap-3">
        <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", iconColors[type])} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          {action && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-2"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface StepErrorBadgeProps {
  type: "screenshot_missing" | "sync_failed" | "selector_risk";
  onAction?: () => void;
  className?: string;
}

export function StepErrorBadge({ type, onAction, className }: StepErrorBadgeProps) {
  const configs = {
    screenshot_missing: {
      icon: Camera,
      label: "No image",
      color: "text-yellow-500",
    },
    sync_failed: {
      icon: AlertTriangle,
      label: "Not saved",
      color: "text-red-500",
    },
    selector_risk: {
      icon: AlertTriangle,
      label: "Selector risk",
      color: "text-yellow-500",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onAction}
      className={cn(
        "flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors",
        config.color,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </button>
  );
}
