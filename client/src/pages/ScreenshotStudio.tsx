import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, Sparkles, Chrome, Camera } from "lucide-react";
import { ScreenshotBeautifier } from "@/components/ScreenshotBeautifier";
import { Sidebar, SidebarProvider, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function ScreenshotStudioContent() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWaitingForCapture, setIsWaitingForCapture] = useState(false);
  const { toast } = useToast();
  const { isCollapsed } = useSidebarState();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    }
  }, []);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"]
    },
    noClick: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
  });

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setImageUrl(url);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data?.type === "FLOWCAPTURE_SCREENSHOT_CAPTURED" && event.data?.screenshot) {
        const timeoutId = (window as any).__flowcaptureTimeoutId;
        if (timeoutId) {
          clearTimeout(timeoutId);
          delete (window as any).__flowcaptureTimeoutId;
        }
        
        setImageUrl(event.data.screenshot);
        setIsWaitingForCapture(false);
        toast({ title: "Screenshot captured successfully" });
      }
    };

    window.addEventListener("message", handleExtensionMessage);
    return () => window.removeEventListener("message", handleExtensionMessage);
  }, [toast]);

  const handleCaptureViaExtension = () => {
    window.postMessage({ type: "FLOWCAPTURE_REQUEST_SCREENSHOT" }, "*");
    setIsWaitingForCapture(true);
    toast({ 
      title: "Capturing screenshot...",
      description: "The extension will capture your current browser tab" 
    });
    
    const timeoutId = setTimeout(() => {
      if (isWaitingForCapture) {
        setIsWaitingForCapture(false);
        toast({ 
          title: "Extension not detected",
          description: "Make sure the FlowCapture Chrome extension is installed and enabled",
          variant: "destructive"
        });
      }
    }, 10000);
    
    (window as any).__flowcaptureTimeoutId = timeoutId;
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <MobileMenuTrigger />
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold" data-testid="text-page-title">
                Screenshot Studio
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base ml-0 sm:ml-14">
              Transform your screenshots into beautiful visuals with backgrounds, device mockups, and effects.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!imageUrl ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card 
                  {...getRootProps()} 
                  className={`border-2 border-dashed transition-colors cursor-pointer ${
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <CardContent className="flex flex-col items-center justify-center py-10 sm:py-16 px-4">
                    <input {...getInputProps()} data-testid="input-file" />
                    <div className={`p-3 sm:p-4 rounded-full mb-4 transition-colors ${
                      isDragging ? "bg-primary/20" : "bg-muted"
                    }`}>
                      {isDragging ? (
                        <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                      ) : (
                        <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-medium mb-2 text-center">
                      {isDragging ? "Drop your screenshot" : "Add a screenshot"}
                    </h2>
                    <p className="text-muted-foreground text-center max-w-md mb-6 text-sm sm:text-base">
                      Capture directly from your browser, drag and drop, paste from clipboard, or upload
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full sm:w-auto">
                      <Button 
                        onClick={handleCaptureViaExtension} 
                        size="lg" 
                        disabled={isWaitingForCapture}
                        data-testid="button-capture-extension"
                        className="w-full sm:w-auto"
                      >
                        {isWaitingForCapture ? (
                          <>
                            <Camera className="w-4 h-4 mr-2 animate-pulse" />
                            <span className="hidden sm:inline">Waiting for capture...</span>
                            <span className="sm:hidden">Capturing...</span>
                          </>
                        ) : (
                          <>
                            <Chrome className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Capture via Extension</span>
                            <span className="sm:hidden">Capture</span>
                          </>
                        )}
                      </Button>
                      <Button onClick={open} size="lg" variant="outline" data-testid="button-browse" className="w-full sm:w-auto">
                        <Upload className="w-4 h-4 mr-2" />
                        Browse Files
                      </Button>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Supports PNG, JPG, WebP, GIF
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setImageUrl(null)}
                    data-testid="button-new-image"
                    className="text-sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload New Image
                  </Button>
                </div>
                <ScreenshotBeautifier imageUrl={imageUrl} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tips section */}
          <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <Card>
              <CardContent className="pt-5 sm:pt-6">
                <div className="p-2 rounded-lg bg-blue-500/10 w-fit mb-3">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                </div>
                <h3 className="font-medium mb-1 text-sm sm:text-base">Gradient Backgrounds</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Choose from beautiful gradient and mesh backgrounds to make your screenshots pop.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 sm:pt-6">
                <div className="p-2 rounded-lg bg-purple-500/10 w-fit mb-3">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                </div>
                <h3 className="font-medium mb-1 text-sm sm:text-base">Device Mockups</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Wrap your screenshots in browser, phone, or laptop frames for professional presentations.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 sm:pt-6">
                <div className="p-2 rounded-lg bg-green-500/10 w-fit mb-3">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                </div>
                <h3 className="font-medium mb-1 text-sm sm:text-base">Easy Export</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Download your beautified screenshots as high-quality PNG files ready to share.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ScreenshotStudio() {
  return (
    <SidebarProvider>
      <ScreenshotStudioContent />
    </SidebarProvider>
  );
}
