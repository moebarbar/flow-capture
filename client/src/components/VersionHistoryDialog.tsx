import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { History, RotateCcw, Save, Loader2, Eye, Clock } from "lucide-react";
import { format } from "date-fns";

interface GuideVersion {
  id: number;
  guideId: number;
  versionNumber: number;
  title: string;
  description: string | null;
  changeNotes: string | null;
  createdById: string;
  createdAt: string;
}

interface VersionHistoryDialogProps {
  guideId: number;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDialog({ guideId, currentTitle, open, onOpenChange }: VersionHistoryDialogProps) {
  const [changeNotes, setChangeNotes] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const { toast } = useToast();

  const { data: versions = [], refetch, isLoading } = useQuery<GuideVersion[]>({
    queryKey: ['/api/guides', guideId, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/versions`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && guideId > 0,
  });

  const saveVersionMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/versions`, { changeNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Version saved successfully" });
      refetch();
      setChangeNotes("");
      setShowSaveForm(false);
    },
    onError: () => {
      toast({ title: "Failed to save version", variant: "destructive" });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/versions/${versionId}/restore`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Version restored successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId, 'steps'] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to restore version", variant: "destructive" });
    },
  });

  const handleSaveVersion = () => {
    saveVersionMutation.mutate(changeNotes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            Save snapshots of your guide and restore previous versions at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 py-2 border-b">
          {showSaveForm ? (
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Describe what changed in this version..."
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                className="text-sm"
                rows={2}
                data-testid="input-version-notes"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveVersion}
                  disabled={saveVersionMutation.isPending}
                  data-testid="button-confirm-save-version"
                >
                  {saveVersionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save Version
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSaveForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowSaveForm(true)} data-testid="button-save-version">
              <Save className="h-4 w-4 mr-2" />
              Save Current Version
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 py-2 pr-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && versions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No saved versions yet</p>
                <p className="text-xs mt-1">Save a version to track changes over time</p>
              </div>
            )}

            {versions.map((version) => (
              <div
                key={version.id}
                className="p-3 rounded-lg border hover:border-muted-foreground/30 transition-colors"
                data-testid={`version-item-${version.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        v{version.versionNumber}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {version.title}
                      </span>
                    </div>
                    {version.changeNotes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {version.changeNotes}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreVersionMutation.mutate(version.id)}
                    disabled={restoreVersionMutation.isPending}
                    data-testid={`button-restore-version-${version.id}`}
                  >
                    {restoreVersionMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
