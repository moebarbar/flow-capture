import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, RefreshCw, Settings } from "lucide-react";
import { useExtensionDetection } from "@/hooks/use-extension-detection";
import { useEffect } from "react";

interface PermissionDeniedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionDeniedDialog({ open, onOpenChange }: PermissionDeniedDialogProps) {
  const { permissionStatus, isRequestingPermission, requestPermissions } = useExtensionDetection();

  useEffect(() => {
    if (permissionStatus === 'granted' && open) {
      onOpenChange(false);
    }
  }, [permissionStatus, open, onOpenChange]);

  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-xl">Permissions Required</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            FlowCapture needs permission to access web pages in order to capture your workflow steps and take screenshots.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">What we need access to:</p>
                <p className="text-sm text-muted-foreground">
                  Permission to read page content and capture screenshots on websites you visit during recording.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">Your privacy matters:</p>
                <p className="text-sm text-muted-foreground">
                  We only access pages during active capture sessions. No data is collected when you&apos;re not recording.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleRequestPermissions}
              disabled={isRequestingPermission}
              className="w-full"
              data-testid="button-grant-permissions"
            >
              {isRequestingPermission ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Grant Permissions
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="w-full"
              data-testid="button-cancel-permissions"
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            A Chrome permission prompt will appear. Click &quot;Allow&quot; to enable capture.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
