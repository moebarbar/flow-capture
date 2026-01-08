import { useEffect } from "react";
import { useExtensionDetection } from "@/hooks/use-extension-detection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiGooglechrome } from "react-icons/si";
import { Download, CheckCircle } from "lucide-react";

interface InstallExtensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallExtensionDialog({ open, onOpenChange }: InstallExtensionDialogProps) {
  const { isExtensionInstalled } = useExtensionDetection();

  // Auto-dismiss when extension is detected
  useEffect(() => {
    if (isExtensionInstalled && open) {
      onOpenChange(false);
    }
  }, [isExtensionInstalled, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-install-extension">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SiGooglechrome className="h-5 w-5 text-brand-600" />
            Chrome Extension Required
          </DialogTitle>
          <DialogDescription>
            To capture browser workflows, you need to install the FlowCapture Chrome extension first.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                <span className="text-brand-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-sm">Install the extension</p>
                <p className="text-xs text-muted-foreground">Click the button below to open Chrome Web Store</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                <span className="text-brand-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-sm">Pin to toolbar</p>
                <p className="text-xs text-muted-foreground">Click the puzzle icon and pin FlowCapture</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                <span className="text-brand-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-sm">Return here</p>
                <p className="text-xs text-muted-foreground">This dialog will close automatically when detected</p>
              </div>
            </div>
          </div>

          {isExtensionInstalled && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Extension detected! You're all set.</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 bg-brand-600 hover:bg-brand-700"
            asChild
          >
            <a 
              href="https://chrome.google.com/webstore" 
              target="_blank" 
              rel="noopener noreferrer"
              data-testid="button-install-extension"
            >
              <Download className="mr-2 h-4 w-4" />
              Get Extension (Free)
            </a>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-install">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
