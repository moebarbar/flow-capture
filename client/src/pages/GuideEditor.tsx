import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { useGuide, useUpdateGuide } from "@/hooks/use-guides";
import { useSteps, useCreateStep, useUpdateStep, useReorderSteps, useDeleteStep } from "@/hooks/use-steps";
import { useGenerateDescription } from "@/hooks/use-ai";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/components/Sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ScreenshotBeautifier } from "@/components/ScreenshotBeautifier";
import { ElementZoomAnimation } from "@/components/ElementHighlightOverlay";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, ArrowLeft, Wand2, MoreHorizontal, Trash2, 
  GripVertical, Image as ImageIcon, CheckCircle, ExternalLink, Sparkles, Upload,
  Share2, Copy, Lock, Eye, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function GuideEditor() {
  const [, params] = useRoute("/guides/:id/edit");
  const guideId = parseInt(params?.id || "0");
  const { data: guide, isLoading: guideLoading } = useGuide(guideId);
  const { data: steps, isLoading: stepsLoading } = useSteps(guideId);
  
  const { mutate: updateGuide } = useUpdateGuide();
  const { mutate: createStep } = useCreateStep();
  const { mutate: updateStep } = useUpdateStep();
  const { mutate: deleteStep } = useDeleteStep();
  const { mutate: reorderSteps } = useReorderSteps();
  const { mutate: generateDesc, isPending: isGenerating } = useGenerateDescription();

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [beautifierOpen, setBeautifierOpen] = useState(false);
  const [beautifierImageUrl, setBeautifierImageUrl] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Share settings query
  const { data: shareSettings, refetch: refetchShare } = useQuery({
    queryKey: ['/api/guides', guideId, 'share'],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/share`, { credentials: 'include' });
      if (!res.ok) return { enabled: false, hasPassword: false, shareUrl: null };
      return res.json();
    },
    enabled: guideId > 0,
  });

  const updateShareMutation = useMutation({
    mutationFn: async (data: { password?: string | null; enabled?: boolean }) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/share`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchShare();
      toast({ title: "Share settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update share settings", variant: "destructive" });
    },
  });

  const handleCopyLink = () => {
    if (shareSettings?.shareUrl) {
      navigator.clipboard.writeText(shareSettings.shareUrl);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const handleSetPassword = () => {
    updateShareMutation.mutate({ password: sharePassword || null, enabled: true });
    setSharePassword("");
  };

  const handleRemovePassword = () => {
    updateShareMutation.mutate({ password: null });
  };

  const handleToggleSharing = (enabled: boolean) => {
    updateShareMutation.mutate({ enabled });
  };

  const openBeautifier = (imageUrl: string) => {
    setBeautifierImageUrl(imageUrl);
    setBeautifierOpen(true);
  };

  const handleSaveBeautifiedImage = (canvas: HTMLCanvasElement) => {
    if (!selectedStep) return;
    const dataUrl = canvas.toDataURL("image/png");
    updateStep({ id: selectedStep.id, guideId, imageUrl: dataUrl });
    setBeautifierOpen(false);
  };

  const handleAIAnalysis = (analysis: { title: string; description: string }) => {
    if (!selectedStep) return;
    updateStep({ 
      id: selectedStep.id, 
      guideId, 
      title: analysis.title,
      description: analysis.description 
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStep) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateStep({ id: selectedStep.id, guideId, imageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Auto-select first step on load
  useEffect(() => {
    if (steps && steps.length > 0 && !selectedStepId) {
      setSelectedStepId(steps[0].id);
    }
  }, [steps]);

  // Sort steps by order
  const sortedSteps = steps ? [...steps].sort((a, b) => a.order - b.order) : [];
  const selectedStep = sortedSteps.find(s => s.id === selectedStepId);

  const handleAddStep = () => {
    createStep({
      guideId,
      order: (steps?.length || 0) + 1,
      title: "New Step",
      actionType: "click",
      imageUrl: `https://placehold.co/800x600/f3f4f6/a3a3a3?text=Step+${(steps?.length || 0) + 1}`
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || !sortedSteps) return;

    const items = Array.from(sortedSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistic update locally could be done here, but for now we just call API
    reorderSteps({ guideId, stepIds: items.map(i => i.id) });
  };

  const handleAiMagic = () => {
    if (!selectedStep) return;
    generateDesc({
      stepTitle: selectedStep.title || "Unknown Step",
      actionType: selectedStep.actionType,
      context: selectedStep.description || ""
    }, {
      onSuccess: (data) => {
        updateStep({ id: selectedStep.id, guideId, description: data.description });
      }
    });
  };

  if (guideLoading || stepsLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading editor...</div>;
  }

  if (!guide) return <div>Guide not found</div>;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <a href="/"><ArrowLeft className="h-5 w-5" /></a>
          </Button>
          <div className="h-8 w-px bg-border" />
          <Input 
            value={guide.title} 
            onChange={(e) => updateGuide({ id: guideId, title: e.target.value })}
            className="text-lg font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 w-96 font-display"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-4">
            {guide.status === 'draft' ? 'Unsaved changes' : 'All changes saved'}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShareDialogOpen(true)}
            data-testid="button-share-guide"
          >
            <Share2 className="h-4 w-4 mr-2" /> Share
          </Button>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Save className="h-4 w-4 mr-2" /> Publish
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Step List */}
        <div className="w-72 border-r border-border bg-muted/10 flex flex-col shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Steps ({sortedSteps.length})</h3>
            <Button size="sm" variant="ghost" onClick={handleAddStep} className="h-8 w-8 p-0">
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="steps">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {sortedSteps.map((step, index) => (
                      <Draggable key={step.id} draggableId={String(step.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onClick={() => setSelectedStepId(step.id)}
                            className={cn(
                              "relative group p-3 rounded-lg border transition-all cursor-pointer",
                              selectedStepId === step.id 
                                ? "bg-card border-brand-500 shadow-sm ring-1 ring-brand-500/20" 
                                : "bg-card border-transparent hover:border-border hover:shadow-sm",
                              snapshot.isDragging && "shadow-xl rotate-2 scale-105 z-50"
                            )}
                          >
                            <div className="flex gap-3">
                              <div {...provided.dragHandleProps} className="mt-1 text-muted-foreground/50 hover:text-foreground cursor-grab">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold shrink-0">
                                    {index + 1}
                                  </span>
                                  <span className="font-medium text-sm truncate">{step.title || "Untitled Step"}</span>
                                </div>
                                <div className="h-16 w-full bg-muted rounded overflow-hidden relative">
                                  {step.imageUrl ? (
                                    <img src={step.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                      <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>

        {/* Center: Main Canvas */}
        <div className="flex-1 bg-muted/30 p-8 flex items-center justify-center overflow-auto relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
          
          {selectedStep ? (
            <motion.div 
              key={selectedStep.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl bg-card rounded-lg shadow-2xl border border-border overflow-hidden"
            >
              <div className="aspect-video bg-gray-100 relative group/img overflow-hidden">
                {selectedStep.imageUrl ? (
                  <>
                    <img src={selectedStep.imageUrl} alt="Step preview" className="w-full h-full object-contain bg-gray-900" />
                    
                    {/* Element zoom animation for element captures */}
                    {selectedStep.metadata && (selectedStep.metadata as any).isElementCapture && (
                      <ElementZoomAnimation
                        elementBounds={(selectedStep.metadata as any).elementBounds}
                        borderColor={(selectedStep.metadata as any).borderColor || "#ef4444"}
                        isElementCapture={(selectedStep.metadata as any).isElementCapture}
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center invisible group-hover/img:visible z-20">
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={() => openBeautifier(selectedStep.imageUrl!)}
                          data-testid="button-beautify-screenshot"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Beautify
                        </Button>
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-replace-screenshot"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Replace
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
                    <p>No image captured</p>
                    <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Screenshot
                    </Button>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-upload-screenshot"
                />
                
                {/* Simulated Annotation Overlay */}
                {selectedStep.selector && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-12 border-4 border-brand-500 rounded-lg shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                    <div className="absolute -top-10 left-0 bg-brand-500 text-white px-3 py-1 rounded text-sm font-bold shadow-lg">
                      Click here
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="text-center text-muted-foreground">
              Select a step to edit
            </div>
          )}
        </div>

        {/* Right Panel: Properties */}
        <div className="w-80 border-l border-border bg-card p-6 flex flex-col shrink-0 overflow-y-auto">
          {selectedStep ? (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Step Title</label>
                <Input 
                  value={selectedStep.title || ""} 
                  onChange={(e) => updateStep({ id: selectedStep.id, guideId, title: e.target.value })}
                  placeholder="e.g. Click the 'Sign Up' button"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground block">Description</label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                    onClick={handleAiMagic}
                    disabled={isGenerating}
                  >
                    <Wand2 className="h-3 w-3 mr-1" /> 
                    {isGenerating ? "Magic..." : "AI Improve"}
                  </Button>
                </div>
                <Textarea 
                  value={selectedStep.description || ""}
                  onChange={(e) => updateStep({ id: selectedStep.id, guideId, description: e.target.value })}
                  placeholder="Add more details about this step..."
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['click', 'input', 'scroll'].map(type => (
                    <button
                      key={type}
                      onClick={() => updateStep({ id: selectedStep.id, guideId, actionType: type as any })}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm border transition-all capitalize",
                        selectedStep.actionType === type 
                          ? "bg-brand-50 border-brand-200 text-brand-700 font-medium" 
                          : "bg-background border-border hover:bg-muted"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-auto">
                 <Button 
                  variant="outline" 
                  className="w-full border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    deleteStep({ id: selectedStep.id, guideId });
                    setSelectedStepId(null);
                  }}
                 >
                   <Trash2 className="h-4 w-4 mr-2" /> Delete Step
                 </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Select a step to view properties
            </div>
          )}
        </div>
      </div>

      <Dialog open={beautifierOpen} onOpenChange={setBeautifierOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Beautify Screenshot
            </DialogTitle>
          </DialogHeader>
          {beautifierImageUrl && (
            <ScreenshotBeautifier
              imageUrl={beautifierImageUrl}
              onSave={handleSaveBeautifiedImage}
              onAIAnalysis={handleAIAnalysis}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Guide
            </DialogTitle>
            <DialogDescription>
              Create a shareable link with optional password protection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Sharing Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="share-enabled" className="flex flex-col gap-1">
                <span>Enable sharing</span>
                <span className="font-normal text-muted-foreground text-sm">
                  Anyone with the link can view this guide
                </span>
              </Label>
              <Switch
                id="share-enabled"
                checked={shareSettings?.enabled || false}
                onCheckedChange={handleToggleSharing}
                data-testid="switch-share-enabled"
              />
            </div>

            {shareSettings?.enabled && (
              <>
                {/* Share Link */}
                <div className="space-y-2">
                  <Label>Shareable Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={shareSettings?.shareUrl || ''} 
                      readOnly 
                      className="flex-1 bg-muted"
                      data-testid="input-share-url"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleCopyLink}
                      data-testid="button-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Password Protection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password Protection
                  </Label>
                  
                  {shareSettings?.hasPassword ? (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm text-muted-foreground">
                        Password is set
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRemovePassword}
                        data-testid="button-remove-password"
                      >
                        Remove Password
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={sharePassword}
                          onChange={(e) => setSharePassword(e.target.value)}
                          placeholder="Enter a password (optional)"
                          className="pr-10"
                          data-testid="input-share-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button 
                        onClick={handleSetPassword}
                        disabled={!sharePassword || updateShareMutation.isPending}
                        className="w-full"
                        data-testid="button-set-password"
                      >
                        {updateShareMutation.isPending ? "Saving..." : "Set Password"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Access Stats */}
                {shareSettings?.accessCount !== undefined && shareSettings.accessCount > 0 && (
                  <div className="pt-4 border-t text-sm text-muted-foreground">
                    Viewed {shareSettings.accessCount} time{shareSettings.accessCount !== 1 ? 's' : ''}
                    {shareSettings.lastAccessedAt && (
                      <span> (last access: {new Date(shareSettings.lastAccessedAt).toLocaleDateString()})</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
