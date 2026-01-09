import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, CheckCircle, Loader2 } from "lucide-react";
import type { KbCategory } from "@shared/schema";

interface KnowledgeBaseDialogProps {
  guideId: number;
  guideTitle: string;
  guideDescription?: string | null;
  stepsCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeBaseDialog({ 
  guideId, 
  guideTitle,
  guideDescription,
  stepsCount = 0,
  open, 
  onOpenChange 
}: KnowledgeBaseDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(guideTitle);
  const [excerpt, setExcerpt] = useState(guideDescription || "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(guideTitle);
      setExcerpt(guideDescription || "");
      setCategoryId("");
      setTags("");
    }
  }, [open, guideTitle, guideDescription]);

  const { data: categories } = useQuery<KbCategory[]>({
    queryKey: ['/api/kb/categories'],
    enabled: open,
  });

  const convertMutation = useMutation({
    mutationFn: async (data: { title: string; excerpt: string; categoryId?: number; tags: string[] }) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/convert-to-kb`, data);
      return res.json();
    },
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guides'] });
      toast({
        title: "Published to Knowledge Base!",
        description: `"${article.title}" has been created as a draft article.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Conversion failed",
        description: error.message || "Failed to publish flow to Knowledge Base.",
        variant: "destructive",
      });
    },
  });

  const handleConvert = () => {
    const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    convertMutation.mutate({
      title,
      excerpt,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      tags: tagsArray,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Publish to Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Convert this flow into a searchable Knowledge Base article. The article will be created as a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kb-title">Article Title</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article title"
              data-testid="input-kb-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-excerpt">Excerpt / Summary</Label>
            <Textarea
              id="kb-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief description of what this article covers..."
              className="resize-none"
              rows={3}
              data-testid="input-kb-excerpt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="select-kb-category">
                <SelectValue placeholder="Select a category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)} data-testid={`option-category-${cat.id}`}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
            <Input
              id="kb-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. tutorial, workflow, onboarding"
              data-testid="input-kb-tags"
            />
          </div>

          {stepsCount > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Preview</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {stepsCount} step{stepsCount !== 1 ? 's' : ''} will be converted
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Screenshots and descriptions included
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Article created as draft for review
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-kb-convert"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={!title.trim() || convertMutation.isPending}
            data-testid="button-confirm-kb-convert"
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Publish to KB
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
