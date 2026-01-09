import { useState, useEffect } from "react";
import { useMoveFlowToCollection, useCollections, useCreateCollection } from "@/hooks/use-collections";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Loader2, Plus, ChevronLeft } from "lucide-react";

interface CollectionAssignDialogProps {
  guideId: number;
  workspaceId?: number;
  currentCollectionId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionAssignDialog({ 
  guideId, 
  workspaceId,
  currentCollectionId,
  open, 
  onOpenChange 
}: CollectionAssignDialogProps) {
  const { toast } = useToast();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    currentCollectionId?.toString() || "none"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  
  const { data: collections } = useCollections(workspaceId);
  const { mutate: moveFlowToCollection, isPending } = useMoveFlowToCollection();
  const { mutate: createCollection, isPending: isCreatingCollection } = useCreateCollection();

  useEffect(() => {
    if (open) {
      setSelectedCollectionId(currentCollectionId?.toString() || "none");
      setIsCreating(false);
      setNewCollectionName("");
    }
  }, [open, guideId, currentCollectionId]);

  const handleCreateCollection = () => {
    if (!workspaceId || !newCollectionName.trim()) return;
    
    createCollection(
      { workspaceId, name: newCollectionName.trim() },
      {
        onSuccess: (newCollection) => {
          toast({ title: "Collection created" });
          setSelectedCollectionId(newCollection.id.toString());
          setIsCreating(false);
          setNewCollectionName("");
        },
        onError: () => {
          toast({ title: "Failed to create collection", variant: "destructive" });
        },
      }
    );
  };

  const handleSave = () => {
    const collectionId = selectedCollectionId === "none" ? null : parseInt(selectedCollectionId);
    moveFlowToCollection(
      { flowId: guideId, collectionId },
      {
        onSuccess: () => {
          toast({ title: collectionId ? "Moved to collection" : "Removed from collection" });
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Failed to update collection", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Assign to Collection
          </DialogTitle>
          <DialogDescription>
            Organize this flow by assigning it to a collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isCreating ? (
            <div className="space-y-3">
              <button 
                onClick={() => setIsCreating(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-back-to-select"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to selection
              </button>
              <div className="space-y-2">
                <Label htmlFor="new-collection-name">Collection Name</Label>
                <Input
                  id="new-collection-name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g., Onboarding Flows"
                  data-testid="input-new-collection-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCollectionName.trim()) {
                      handleCreateCollection();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim() || isCreatingCollection}
                className="w-full"
                data-testid="button-create-collection"
              >
                {isCreatingCollection ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Collection
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="collection-select">Collection</Label>
                <Select value={selectedCollectionId} onValueChange={setSelectedCollectionId}>
                  <SelectTrigger data-testid="select-collection-assign">
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Collection</SelectItem>
                    {collections?.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id.toString()}>
                        <span className="flex items-center gap-2">
                          {collection.color && (
                            <span 
                              className="h-2 w-2 rounded-full shrink-0" 
                              style={{ backgroundColor: collection.color }}
                            />
                          )}
                          {collection.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsCreating(true)}
                className="w-full"
                data-testid="button-show-create-collection"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Collection
              </Button>
            </>
          )}
        </div>

        {!isCreating && (
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-collection"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              data-testid="button-save-collection"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
