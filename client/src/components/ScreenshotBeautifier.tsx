import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Monitor, 
  Smartphone, 
  Laptop, 
  Square, 
  Download, 
  RotateCcw,
  Palette,
  Layers,
  Sun,
  Move,
  Sparkles,
  Loader2,
  Copy,
  Check
} from "lucide-react";

interface BackgroundTemplate {
  id: string;
  name: string;
  type: "solid" | "gradient" | "mesh" | "pattern";
  value: string;
  preview: string;
}

const backgroundTemplates: BackgroundTemplate[] = [
  { id: "gradient-purple", name: "Purple Dream", type: "gradient", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "gradient-blue", name: "Ocean Blue", type: "gradient", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", preview: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { id: "gradient-sunset", name: "Sunset", type: "gradient", value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", preview: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { id: "gradient-mint", name: "Fresh Mint", type: "gradient", value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", preview: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { id: "gradient-dark", name: "Dark Mode", type: "gradient", value: "linear-gradient(135deg, #232526 0%, #414345 100%)", preview: "linear-gradient(135deg, #232526 0%, #414345 100%)" },
  { id: "gradient-rose", name: "Rose Gold", type: "gradient", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", preview: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { id: "mesh-purple", name: "Mesh Purple", type: "mesh", value: "radial-gradient(at 40% 20%, hsla(280,100%,70%,1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,1) 0px, transparent 50%), radial-gradient(at 80% 50%, hsla(340,100%,76%,1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(22,100%,77%,1) 0px, transparent 50%), radial-gradient(at 80% 100%, hsla(242,100%,70%,1) 0px, transparent 50%), radial-gradient(at 0% 0%, hsla(343,100%,76%,1) 0px, transparent 50%)", preview: "linear-gradient(135deg, #a855f7, #ec4899)" },
  { id: "mesh-blue", name: "Mesh Ocean", type: "mesh", value: "radial-gradient(at 0% 0%, hsla(200,100%,70%,1) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(180,100%,56%,1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(220,100%,70%,1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(160,100%,70%,1) 0px, transparent 50%)", preview: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
  { id: "solid-white", name: "Clean White", type: "solid", value: "#ffffff", preview: "#ffffff" },
  { id: "solid-dark", name: "Dark Slate", type: "solid", value: "#1e293b", preview: "#1e293b" },
  { id: "solid-gray", name: "Light Gray", type: "solid", value: "#f1f5f9", preview: "#f1f5f9" },
  { id: "solid-cream", name: "Warm Cream", type: "solid", value: "#fef3c7", preview: "#fef3c7" },
];

type DeviceMockup = "none" | "browser" | "phone" | "laptop";

interface AIAnalysis {
  title: string;
  description: string;
  highlights: string[];
}

interface ScreenshotBeautifierProps {
  imageUrl: string;
  onSave?: (canvas: HTMLCanvasElement) => void;
  onAIAnalysis?: (analysis: AIAnalysis) => void;
  className?: string;
}

export function ScreenshotBeautifier({ imageUrl, onSave, onAIAnalysis, className }: ScreenshotBeautifierProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundTemplate>(backgroundTemplates[0]);
  const [deviceMockup, setDeviceMockup] = useState<DeviceMockup>("browser");
  const [padding, setPadding] = useState(60);
  const [borderRadius, setBorderRadius] = useState(12);
  const [shadowIntensity, setShadowIntensity] = useState(30);
  const [scale, setScale] = useState(85);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const convertToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const analyzeScreenshotMutation = useMutation({
    mutationFn: async () => {
      const base64Data = await convertToBase64(imageUrl);
      const response = await apiRequest("POST", "/api/ai/analyze-screenshot", {
        imageBase64: base64Data,
      });
      return response.json();
    },
    onSuccess: (data: AIAnalysis) => {
      setAiAnalysis(data);
      onAIAnalysis?.(data);
    },
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageLoaded(true);
      renderCanvas(ctx, canvas, img);
    };
    img.src = imageUrl;
  }, [imageUrl, selectedBackground, deviceMockup, padding, borderRadius, shadowIntensity, scale]);

  const renderCanvas = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const scaleFactor = scale / 100;
    const scaledWidth = img.width * scaleFactor;
    const scaledHeight = img.height * scaleFactor;
    
    let mockupPadding = { top: 0, right: 0, bottom: 0, left: 0 };
    if (deviceMockup === "browser") {
      mockupPadding = { top: 36, right: 0, bottom: 0, left: 0 };
    } else if (deviceMockup === "phone") {
      mockupPadding = { top: 24, right: 12, bottom: 24, left: 12 };
    } else if (deviceMockup === "laptop") {
      mockupPadding = { top: 20, right: 20, bottom: 40, left: 20 };
    }

    const totalWidth = scaledWidth + mockupPadding.left + mockupPadding.right + padding * 2;
    const totalHeight = scaledHeight + mockupPadding.top + mockupPadding.bottom + padding * 2;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // Draw background
    if (selectedBackground.type === "solid") {
      ctx.fillStyle = selectedBackground.value;
      ctx.fillRect(0, 0, totalWidth, totalHeight);
    } else {
      // For gradients, create a temporary canvas element to parse the gradient
      const gradient = ctx.createLinearGradient(0, 0, totalWidth, totalHeight);
      if (selectedBackground.id.includes("purple")) {
        gradient.addColorStop(0, "#667eea");
        gradient.addColorStop(1, "#764ba2");
      } else if (selectedBackground.id.includes("blue")) {
        gradient.addColorStop(0, "#4facfe");
        gradient.addColorStop(1, "#00f2fe");
      } else if (selectedBackground.id.includes("sunset")) {
        gradient.addColorStop(0, "#fa709a");
        gradient.addColorStop(1, "#fee140");
      } else if (selectedBackground.id.includes("mint")) {
        gradient.addColorStop(0, "#11998e");
        gradient.addColorStop(1, "#38ef7d");
      } else if (selectedBackground.id.includes("dark")) {
        gradient.addColorStop(0, "#232526");
        gradient.addColorStop(1, "#414345");
      } else if (selectedBackground.id.includes("rose")) {
        gradient.addColorStop(0, "#f093fb");
        gradient.addColorStop(1, "#f5576c");
      } else if (selectedBackground.id === "mesh-purple") {
        gradient.addColorStop(0, "#a855f7");
        gradient.addColorStop(0.5, "#ec4899");
        gradient.addColorStop(1, "#6366f1");
      } else if (selectedBackground.id === "mesh-blue") {
        gradient.addColorStop(0, "#06b6d4");
        gradient.addColorStop(0.5, "#3b82f6");
        gradient.addColorStop(1, "#8b5cf6");
      } else {
        gradient.addColorStop(0, "#667eea");
        gradient.addColorStop(1, "#764ba2");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, totalWidth, totalHeight);
    }

    const imgX = padding + mockupPadding.left;
    const imgY = padding + mockupPadding.top;

    // Draw shadow
    if (shadowIntensity > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0, 0, 0, ${shadowIntensity / 100})`;
      ctx.shadowBlur = shadowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowIntensity / 3;
      
      ctx.fillStyle = "#fff";
      roundRect(ctx, imgX - mockupPadding.left, imgY - mockupPadding.top, 
        scaledWidth + mockupPadding.left + mockupPadding.right, 
        scaledHeight + mockupPadding.top + mockupPadding.bottom, 
        borderRadius);
      ctx.fill();
      ctx.restore();
    }

    // Draw device mockup
    if (deviceMockup === "browser") {
      drawBrowserFrame(ctx, imgX - mockupPadding.left, imgY - mockupPadding.top, 
        scaledWidth + mockupPadding.left + mockupPadding.right, 
        scaledHeight + mockupPadding.top + mockupPadding.bottom, 
        borderRadius);
    } else if (deviceMockup === "phone") {
      drawPhoneFrame(ctx, imgX - mockupPadding.left, imgY - mockupPadding.top, 
        scaledWidth + mockupPadding.left + mockupPadding.right, 
        scaledHeight + mockupPadding.top + mockupPadding.bottom, 
        borderRadius + 8);
    } else if (deviceMockup === "laptop") {
      drawLaptopFrame(ctx, imgX - mockupPadding.left, imgY - mockupPadding.top, 
        scaledWidth + mockupPadding.left + mockupPadding.right, 
        scaledHeight + mockupPadding.top + mockupPadding.bottom, 
        borderRadius);
    }

    // Draw the screenshot with rounded corners
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, imgX, imgY, scaledWidth, scaledHeight, Math.max(0, borderRadius - 4));
    ctx.clip();
    ctx.drawImage(img, imgX, imgY, scaledWidth, scaledHeight);
    ctx.restore();
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const drawBrowserFrame = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    // Browser window background
    ctx.fillStyle = "#f8fafc";
    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();

    // Browser toolbar
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + 36);
    ctx.lineTo(x, y + 36);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Traffic lights
    const circleY = y + 18;
    const circleRadius = 6;
    const startX = x + 16;
    
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(startX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.arc(startX + 20, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(startX + 40, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    // URL bar
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x + 80, y + 8, width - 100, 20, 4);
    ctx.fill();
  };

  const drawPhoneFrame = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    // Phone body
    ctx.fillStyle = "#1f2937";
    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();

    // Inner bezel
    ctx.fillStyle = "#111827";
    roundRect(ctx, x + 4, y + 4, width - 8, height - 8, radius - 4);
    ctx.fill();

    // Notch/Dynamic Island
    ctx.fillStyle = "#1f2937";
    roundRect(ctx, x + width / 2 - 40, y + 8, 80, 16, 8);
    ctx.fill();
  };

  const drawLaptopFrame = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    // Screen bezel
    ctx.fillStyle = "#1f2937";
    roundRect(ctx, x, y, width, height - 20, radius);
    ctx.fill();

    // Inner screen area
    ctx.fillStyle = "#000000";
    roundRect(ctx, x + 8, y + 8, width - 16, height - 36, radius - 4);
    ctx.fill();

    // Base/keyboard area
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.moveTo(x - 20, y + height - 20);
    ctx.lineTo(x + width + 20, y + height - 20);
    ctx.lineTo(x + width + 10, y + height);
    ctx.lineTo(x - 10, y + height);
    ctx.closePath();
    ctx.fill();

    // Trackpad indicator
    ctx.fillStyle = "#4b5563";
    roundRect(ctx, x + width / 2 - 30, y + height - 15, 60, 10, 2);
    ctx.fill();
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "beautified-screenshot.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleReset = () => {
    setSelectedBackground(backgroundTemplates[0]);
    setDeviceMockup("browser");
    setPadding(60);
    setBorderRadius(12);
    setShadowIntensity(30);
    setScale(85);
  };

  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${className}`}>
      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 rounded-lg min-h-[400px]">
        <canvas 
          ref={canvasRef} 
          className="max-w-full max-h-[600px] rounded-lg"
          style={{ display: imageLoaded ? "block" : "none" }}
          data-testid="canvas-preview"
        />
        {!imageLoaded && (
          <div className="text-muted-foreground">Loading preview...</div>
        )}
      </div>

      {/* Controls */}
      <Card className="w-full lg:w-80 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Beautify Screenshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="background" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="background" data-testid="tab-background">
                <Palette className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="mockup" data-testid="tab-mockup">
                <Layers className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="adjust" data-testid="tab-adjust">
                <Sun className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="ai" data-testid="tab-ai">
                <Sparkles className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="background" className="space-y-4 mt-4">
              <Label>Background Template</Label>
              <div className="grid grid-cols-4 gap-2">
                {backgroundTemplates.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg)}
                    className={`w-full aspect-square rounded-lg border-2 transition-all ${
                      selectedBackground.id === bg.id 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    style={{ background: bg.type === "solid" ? bg.value : bg.preview }}
                    title={bg.name}
                    data-testid={`bg-${bg.id}`}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="mockup" className="space-y-4 mt-4">
              <Label>Device Frame</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant={deviceMockup === "none" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setDeviceMockup("none")}
                  data-testid="mockup-none"
                >
                  <Square className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceMockup === "browser" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setDeviceMockup("browser")}
                  data-testid="mockup-browser"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceMockup === "phone" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setDeviceMockup("phone")}
                  data-testid="mockup-phone"
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceMockup === "laptop" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setDeviceMockup("laptop")}
                  data-testid="mockup-laptop"
                >
                  <Laptop className="w-4 h-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="adjust" className="space-y-5 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Move className="w-4 h-4" /> Padding
                  </Label>
                  <span className="text-sm text-muted-foreground">{padding}px</span>
                </div>
                <Slider
                  value={[padding]}
                  onValueChange={([v]) => setPadding(v)}
                  min={20}
                  max={120}
                  step={5}
                  data-testid="slider-padding"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Corner Radius</Label>
                  <span className="text-sm text-muted-foreground">{borderRadius}px</span>
                </div>
                <Slider
                  value={[borderRadius]}
                  onValueChange={([v]) => setBorderRadius(v)}
                  min={0}
                  max={32}
                  step={2}
                  data-testid="slider-radius"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Shadow</Label>
                  <span className="text-sm text-muted-foreground">{shadowIntensity}%</span>
                </div>
                <Slider
                  value={[shadowIntensity]}
                  onValueChange={([v]) => setShadowIntensity(v)}
                  min={0}
                  max={60}
                  step={5}
                  data-testid="slider-shadow"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Scale</Label>
                  <span className="text-sm text-muted-foreground">{scale}%</span>
                </div>
                <Slider
                  value={[scale]}
                  onValueChange={([v]) => setScale(v)}
                  min={50}
                  max={100}
                  step={5}
                  data-testid="slider-scale"
                />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Analysis
                </Label>
                <p className="text-sm text-muted-foreground">
                  Let AI analyze this screenshot and generate a title and description for your guide step.
                </p>
                <Button
                  onClick={() => analyzeScreenshotMutation.mutate()}
                  disabled={analyzeScreenshotMutation.isPending}
                  className="w-full"
                  data-testid="button-analyze"
                >
                  {analyzeScreenshotMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Screenshot
                    </>
                  )}
                </Button>
              </div>

              {aiAnalysis && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Suggested Title</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopy(aiAnalysis.title, "title")}
                        data-testid="button-copy-title"
                      >
                        {copied === "title" ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm font-medium bg-muted/50 rounded-md p-2" data-testid="text-ai-title">
                      {aiAnalysis.title}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Suggested Description</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopy(aiAnalysis.description, "description")}
                        data-testid="button-copy-description"
                      >
                        {copied === "description" ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm bg-muted/50 rounded-md p-2" data-testid="text-ai-description">
                      {aiAnalysis.description}
                    </p>
                  </div>

                  {aiAnalysis.highlights && aiAnalysis.highlights.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Key Elements</Label>
                      <div className="flex flex-wrap gap-1">
                        {aiAnalysis.highlights.map((highlight, i) => (
                          <span
                            key={i}
                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                            data-testid={`text-highlight-${i}`}
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {analyzeScreenshotMutation.isError && (
                <p className="text-sm text-destructive">
                  Failed to analyze screenshot. Please try again.
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="flex-1"
              data-testid="button-reset"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            {onSave ? (
              <Button 
                size="sm" 
                onClick={() => {
                  if (canvasRef.current) {
                    onSave(canvasRef.current);
                  }
                }}
                className="flex-1"
                data-testid="button-apply"
              >
                <Check className="w-4 h-4 mr-2" />
                Apply
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={handleDownload}
                className="flex-1"
                data-testid="button-download"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ScreenshotBeautifier;
