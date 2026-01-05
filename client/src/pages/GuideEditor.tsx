import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useGuide, useUpdateGuide } from "@/hooks/use-guides";
import { useSteps, useCreateStep, useUpdateStep, useReorderSteps, useDeleteStep } from "@/hooks/use-steps";
import { useGenerateDescription } from "@/hooks/use-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar } from "@/components/Sidebar";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { 
  Save, ArrowLeft, Wand2, MoreHorizontal, Trash2, 
  GripVertical, Image as ImageIcon, CheckCircle, ExternalLink 
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
              <div className="aspect-video bg-gray-100 relative group">
                {selectedStep.imageUrl ? (
                   <img src={selectedStep.imageUrl} alt="Step preview" className="w-full h-full object-contain bg-gray-900" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
                    <p>No image captured</p>
                    <Button variant="outline" className="mt-4">Upload Screenshot</Button>
                  </div>
                )}
                
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
