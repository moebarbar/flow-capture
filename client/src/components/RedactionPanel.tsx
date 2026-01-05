import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EyeOff, Trash2, Plus, Eye, Move, Save, X } from "lucide-react";

interface RedactionRegion {
  id: number;
  stepId: number;
  guideId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  detectedType: string | null;
  isAutoDetected: boolean;
  isEnabled: boolean;
}

interface Step {
  id: number;
  title: string | null;
  description: string | null;
  order: number;
  imageUrl: string | null;
}

interface RedactionPanelProps {
  guideId: number;
  steps: Step[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function RedactionPanel({ guideId, steps, open, onOpenChange }: RedactionPanelProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ x: 0, y: 0, width: 30, height: 10 });

  const { data: redactions, refetch: refetchRedactions } = useQuery<RedactionRegion[]>({
    queryKey: ['/api/guides', guideId, 'redactions'],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/redactions`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && guideId > 0,
  });

  const createRedactionMutation = useMutation({
    mutationFn: async ({ stepId, x, y, width, height, type }: { 
      stepId: number; 
      x: number; 
      y: number; 
      width: number; 
      height: number;
      type: string;
    }) => {
      const res = await apiRequest('POST', `/api/steps/${stepId}/redactions`, {
        x, y, width, height, type
      });
      return res.json();
    },
    onSuccess: (data) => {
      refetchRedactions();
      startEditing(data);
      toast({ title: "Blur region added - adjust position and click Save" });
    },
    onError: () => {
      toast({ title: "Failed to add redaction region", variant: "destructive" });
    },
  });

  const updateRedactionMutation = useMutation({
    mutationFn: async ({ id, x, y, width, height }: { 
      id: number;
      x: number; 
      y: number; 
      width: number; 
      height: number;
    }) => {
      const res = await apiRequest('PATCH', `/api/redactions/${id}`, {
        x, y, width, height
      });
      return res.json();
    },
    onSuccess: () => {
      refetchRedactions();
      setEditingId(null);
      toast({ title: "Position saved" });
    },
    onError: () => {
      toast({ title: "Failed to save position", variant: "destructive" });
    },
  });

  const toggleRedactionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/redactions/${id}/toggle`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchRedactions();
    },
  });

  const deleteRedactionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/redactions/${id}`, {});
    },
    onSuccess: () => {
      refetchRedactions();
      if (editingId) setEditingId(null);
      toast({ title: "Blur region removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove redaction region", variant: "destructive" });
    },
  });

  const getRedactionsForStep = (stepId: number) => {
    return redactions?.filter(r => r.stepId === stepId) || [];
  };

  const handleAddManualRedaction = (stepId: number) => {
    createRedactionMutation.mutate({
      stepId,
      x: 10,
      y: 10,
      width: 30,
      height: 8,
      type: 'blur',
    });
  };

  const startEditing = (region: RedactionRegion) => {
    setEditingId(region.id);
    setEditState({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const savePosition = () => {
    if (editingId === null) return;
    updateRedactionMutation.mutate({
      id: editingId,
      x: Math.max(0, Math.min(100, editState.x)),
      y: Math.max(0, Math.min(100, editState.y)),
      width: Math.max(1, Math.min(100, editState.width)),
      height: Math.max(1, Math.min(100, editState.height)),
    });
  };

  const updateLocalState = (field: keyof EditState, value: number) => {
    setEditState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getDisplayRegion = (region: RedactionRegion) => {
    if (editingId === region.id) {
      return editState;
    }
    return { x: region.x, y: region.y, width: region.width, height: region.height };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Hide Sensitive Data
          </DialogTitle>
          <DialogDescription>
            Add blur overlays to hide confidential information. Position and size are percentages (0-100) of the screenshot dimensions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 py-2 items-center border-b pb-4">
          <div className="text-sm text-muted-foreground">
            {redactions?.length || 0} blur region{redactions?.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {steps.map((step) => {
            const stepRedactions = getRedactionsForStep(step.id);
            
            return (
              <div 
                key={step.id} 
                className="border rounded-lg overflow-hidden"
                data-testid={`redaction-step-${step.id}`}
              >
                <div className="p-3 bg-muted/50 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      Step {step.order + 1}: {step.title || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stepRedactions.length} blur region{stepRedactions.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={() => handleAddManualRedaction(step.id)}
                    disabled={createRedactionMutation.isPending}
                    data-testid={`button-add-redaction-${step.id}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Blur Region
                  </Button>
                </div>

                {stepRedactions.length > 0 && (
                  <div className="p-3 space-y-3">
                    {stepRedactions.map((region) => {
                      const isEditing = editingId === region.id;
                      const displayRegion = getDisplayRegion(region);
                      
                      return (
                        <div 
                          key={region.id}
                          className={`p-3 rounded border transition-colors ${isEditing ? 'border-primary bg-primary/5' : 'bg-muted/30'}`}
                          data-testid={`redaction-region-${region.id}`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                Manual
                              </Badge>
                              {!isEditing ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditing(region)}
                                  data-testid={`button-edit-region-${region.id}`}
                                >
                                  <Move className="h-3 w-3 mr-1" />
                                  Edit Position
                                </Button>
                              ) : (
                                <span className="text-sm text-primary font-medium">Editing...</span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={savePosition}
                                    disabled={updateRedactionMutation.isPending}
                                    data-testid={`button-save-region-${region.id}`}
                                  >
                                    <Save className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEditing}
                                    data-testid={`button-cancel-edit-${region.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => toggleRedactionMutation.mutate(region.id)}
                                    data-testid={`button-toggle-redaction-${region.id}`}
                                  >
                                    {region.isEnabled ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => deleteRedactionMutation.mutate(region.id)}
                                    data-testid={`button-delete-redaction-${region.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">X Position (%)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={editState.x}
                                  onChange={(e) => updateLocalState('x', parseInt(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  data-testid={`input-x-${region.id}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Y Position (%)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={editState.y}
                                  onChange={(e) => updateLocalState('y', parseInt(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  data-testid={`input-y-${region.id}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Width (%)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={editState.width}
                                  onChange={(e) => updateLocalState('width', parseInt(e.target.value) || 1)}
                                  className="h-8 text-sm"
                                  data-testid={`input-width-${region.id}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Height (%)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={editState.height}
                                  onChange={(e) => updateLocalState('height', parseInt(e.target.value) || 1)}
                                  className="h-8 text-sm"
                                  data-testid={`input-height-${region.id}`}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Position: ({region.x}%, {region.y}%) | Size: {region.width}% x {region.height}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {step.imageUrl && stepRedactions.filter(r => r.isEnabled).length > 0 && (
                  <div className="relative p-3 border-t bg-muted/20">
                    <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                    <div className="relative inline-block w-full max-w-md">
                      <img 
                        src={step.imageUrl} 
                        alt={`Step ${step.order + 1}`}
                        className="w-full rounded border"
                      />
                      {stepRedactions.filter(r => r.isEnabled).map((region) => {
                        const display = getDisplayRegion(region);
                        const isEditing = editingId === region.id;
                        return (
                          <div
                            key={region.id}
                            className={`absolute backdrop-blur-md rounded ${isEditing ? 'bg-primary/60 border-2 border-primary' : 'bg-black/70'}`}
                            style={{
                              left: `${display.x}%`,
                              top: `${display.y}%`,
                              width: `${display.width}%`,
                              height: `${display.height}%`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {steps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Add steps to your guide to manage redactions.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
