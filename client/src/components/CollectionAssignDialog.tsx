import { useState, useEffect } from "react";
import { useMoveFlowToCollection, useCollections } from "@/hooks/use-collections";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Loader2 } from "lucide-react";

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
  
  const { data: collections } = useCollections(workspaceId);
  const { mutate: moveFlowToCollection, isPending } = useMoveFlowToCollection();

  useEffect(() => {
    if (open) {
      setSelectedCollectionId(currentCollectionId?.toString() || "none");
    }
  }, [open, guideId, currentCollectionId]);

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

          {collections?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No collections available. Create a collection first to organize your flows.
            </p>
          )}
        </div>

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
      </DialogContent>
    </Dialog>
  );
}
