import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Upload, FileText, CheckCircle2, AlertCircle, Download, Loader2 } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { cn } from "@/lib/utils";

interface FlowLauncherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isExtensionInstalled: boolean | null;
  permissionStatus: 'granted' | 'denied' | 'unknown' | 'pending';
  onStartCapture: () => void;
  onUploadScreenshots: () => void;
  onUseTemplate?: () => void;
  isCreating?: boolean;
}

export function FlowLauncherModal({
  open,
  onOpenChange,
  isExtensionInstalled,
  permissionStatus,
  onStartCapture,
  onUploadScreenshots,
  onUseTemplate,
  isCreating = false,
}: FlowLauncherModalProps) {
  const isDetecting = isExtensionInstalled === null;
  const extensionReady = isExtensionInstalled === true && permissionStatus === 'granted';
  const needsExtension = isExtensionInstalled === false;
  const needsPermissions = isExtensionInstalled === true && permissionStatus !== 'granted';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" data-testid="modal-flow-launcher">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-bold text-white">
              Create Step-by-Step Documentation
            </DialogTitle>
          </DialogHeader>
          <p className="text-brand-100 mt-2">
            SOPs, training guides, onboarding docs, how-to tutorials - all in minutes
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div
            className={cn(
              "relative rounded-xl border-2 p-5 transition-all",
              extensionReady 
                ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30 hover-elevate cursor-pointer" 
                : "border-border bg-muted/30"
            )}
            onClick={extensionReady ? onStartCapture : undefined}
            data-testid="option-start-capture"
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-xl shrink-0",
                extensionReady 
                  ? "bg-brand-500 text-white" 
                  : "bg-muted text-muted-foreground"
              )}>
                <Play className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={cn(
                    "font-semibold text-lg",
                    extensionReady ? "text-foreground" : "text-muted-foreground"
                  )}>
                    Start Capturing
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    Recommended
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Just do your workflow - we capture every click with screenshots and AI descriptions
                </p>
                
                {extensionReady && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Extension ready</span>
                  </div>
                )}
                
                {needsExtension && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Chrome extension required</span>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-full"
                      asChild
                      data-testid="button-install-extension"
                    >
                      <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Install Extension
                      </a>
                    </Button>
                  </div>
                )}
                
                {needsPermissions && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Permissions required</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={onStartCapture}
                      data-testid="button-grant-permissions"
                    >
                      Grant Permissions
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <Button
              size="lg"
              className="w-full mt-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20"
              onClick={(e) => {
                e.stopPropagation();
                if (extensionReady) {
                  onStartCapture();
                }
              }}
              disabled={isCreating || !extensionReady || isDetecting}
              data-testid="button-start-capture"
            >
              {isCreating ? (
                "Creating..."
              ) : isDetecting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Checking Extension...
                </>
              ) : needsExtension ? (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Install Extension to Start
                </>
              ) : needsPermissions ? (
                <>
                  <AlertCircle className="mr-2 h-5 w-5" />
                  Grant Permissions to Start
                </>
              ) : (
                <>
                  <SiGooglechrome className="mr-2 h-5 w-5" />
                  Start Capture Session
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or choose another option
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover-elevate text-left transition-all"
              onClick={onUploadScreenshots}
              data-testid="option-upload-screenshots"
            >
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Upload Screenshots</h4>
                <p className="text-xs text-muted-foreground">Add existing images manually</p>
              </div>
            </button>

            {onUseTemplate && (
              <button
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover-elevate text-left transition-all"
                onClick={onUseTemplate}
                data-testid="option-use-template"
              >
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Use Template</h4>
                  <p className="text-xs text-muted-foreground">Start from a pre-made flow</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
