import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Circle, Pause, AlertTriangle, CheckCircle, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type HealthStatus = "healthy" | "warning" | "error" | "offline";

export interface CaptureHealth {
  connection: HealthStatus;
  screenshots: HealthStatus;
  network: HealthStatus;
  sync: HealthStatus;
  pendingSteps?: number;
  lastError?: string;
}

interface RecordingIndicatorProps {
  isRecording: boolean;
  isPaused: boolean;
  stepCount: number;
  startTime?: Date;
  health?: CaptureHealth;
  onHealthClick?: () => void;
  className?: string;
}

export function RecordingIndicator({
  isRecording,
  isPaused,
  stepCount,
  startTime,
  health,
  onHealthClick,
  className,
}: RecordingIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [prevStepCount, setPrevStepCount] = useState(stepCount);
  const [stepBump, setStepBump] = useState(false);

  useEffect(() => {
    if (!isRecording || !startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      if (!isPaused) {
        setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused, startTime]);

  useEffect(() => {
    if (stepCount > prevStepCount) {
      setStepBump(true);
      const timeout = setTimeout(() => setStepBump(false), 200);
      setPrevStepCount(stepCount);
      return () => clearTimeout(timeout);
    }
    setPrevStepCount(stepCount);
  }, [stepCount, prevStepCount]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }, []);

  const getOverallHealth = useCallback((): HealthStatus => {
    if (!health) return "healthy";
    const statuses = [health.connection, health.screenshots, health.network, health.sync];
    if (statuses.includes("error")) return "error";
    if (statuses.includes("warning")) return "warning";
    if (statuses.includes("offline")) return "offline";
    return "healthy";
  }, [health]);

  const overallHealth = getOverallHealth();

  if (!isRecording) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-full",
        "bg-background/95 backdrop-blur-sm border shadow-lg",
        "transition-all duration-200",
        className
      )}
      data-testid="recording-indicator"
    >
      {isPaused ? (
        <div className="flex items-center gap-2">
          <Pause className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-500">Paused</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-30" />
          </div>
          <span className="text-sm font-medium text-foreground">Recording</span>
        </div>
      )}

      <div className="h-4 w-px bg-border" />

      <span className="text-sm font-mono text-muted-foreground tabular-nums" data-testid="recording-timer">
        {formatTime(elapsedTime)}
      </span>

      <div className="h-4 w-px bg-border" />

      <span
        className={cn(
          "text-sm font-medium tabular-nums transition-transform duration-200",
          stepBump && "scale-110"
        )}
        data-testid="step-count"
      >
        {stepCount} {stepCount === 1 ? "step" : "steps"}
      </span>

      {health && (
        <>
          <div className="h-4 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onHealthClick}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                data-testid="health-indicator"
              >
                {overallHealth === "healthy" && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {overallHealth === "warning" && (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
                {overallHealth === "error" && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                {overallHealth === "offline" && (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {overallHealth === "healthy" && "All systems working"}
              {overallHealth === "warning" && "Some issues detected"}
              {overallHealth === "error" && "Attention needed"}
              {overallHealth === "offline" && "You're offline"}
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

interface FloatingRecordingIndicatorProps extends RecordingIndicatorProps {
  position?: "top-center" | "top-left" | "top-right";
}

export function FloatingRecordingIndicator({
  position = "top-center",
  ...props
}: FloatingRecordingIndicatorProps) {
  const positionClasses = {
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
  };

  return (
    <div
      className={cn(
        "fixed z-50",
        positionClasses[position]
      )}
    >
      <RecordingIndicator {...props} />
    </div>
  );
}
