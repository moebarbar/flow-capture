import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, Sparkles, Chrome, Camera } from "lucide-react";
import { ScreenshotBeautifier } from "@/components/ScreenshotBeautifier";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function ScreenshotStudio() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWaitingForCapture, setIsWaitingForCapture] = useState(false);
  const { toast } = useToast();

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

  // Listen for screenshots from Chrome extension
  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data?.type === "FLOWCAPTURE_SCREENSHOT_CAPTURED" && event.data?.screenshot) {
        // Clear the timeout since capture succeeded
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
    // Send message to extension content script
    window.postMessage({ type: "FLOWCAPTURE_REQUEST_SCREENSHOT" }, "*");
    setIsWaitingForCapture(true);
    toast({ 
      title: "Capturing screenshot...",
      description: "The extension will capture your current browser tab" 
    });
    
    // Auto-timeout after 10 seconds with helpful error message
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
    
    // Store timeout ID to clear it if capture succeeds
    (window as any).__flowcaptureTimeoutId = timeoutId;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Screenshot Studio
            </h1>
          </div>
          <p className="text-muted-foreground">
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
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <input {...getInputProps()} data-testid="input-file" />
                  <div className={`p-4 rounded-full mb-4 transition-colors ${
                    isDragging ? "bg-primary/20" : "bg-muted"
                  }`}>
                    {isDragging ? (
                      <Upload className="w-10 h-10 text-primary" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>
                  <h2 className="text-xl font-medium mb-2">
                    {isDragging ? "Drop your screenshot" : "Add a screenshot"}
                  </h2>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Capture directly from your browser, drag and drop, paste from clipboard, or upload
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <Button 
                      onClick={handleCaptureViaExtension} 
                      size="lg" 
                      disabled={isWaitingForCapture}
                      data-testid="button-capture-extension"
                    >
                      {isWaitingForCapture ? (
                        <>
                          <Camera className="w-4 h-4 mr-2 animate-pulse" />
                          Waiting for capture...
                        </>
                      ) : (
                        <>
                          <Chrome className="w-4 h-4 mr-2" />
                          Capture via Extension
                        </>
                      )}
                    </Button>
                    <Button onClick={open} size="lg" variant="outline" data-testid="button-browse">
                      <Upload className="w-4 h-4 mr-2" />
                      Browse Files
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
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
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="p-2 rounded-lg bg-blue-500/10 w-fit mb-3">
                <ImageIcon className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-medium mb-1">Gradient Backgrounds</h3>
              <p className="text-sm text-muted-foreground">
                Choose from beautiful gradient and mesh backgrounds to make your screenshots pop.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="p-2 rounded-lg bg-purple-500/10 w-fit mb-3">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="font-medium mb-1">Device Mockups</h3>
              <p className="text-sm text-muted-foreground">
                Wrap your screenshots in browser, phone, or laptop frames for professional presentations.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="p-2 rounded-lg bg-green-500/10 w-fit mb-3">
                <Upload className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="font-medium mb-1">Easy Export</h3>
              <p className="text-sm text-muted-foreground">
                Download your beautified screenshots as high-quality PNG files ready to share.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
