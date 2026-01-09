import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Lock, Eye, EyeOff } from "lucide-react";

interface ShareFlowDialogProps {
  guideId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareFlowDialog({ guideId, open, onOpenChange }: ShareFlowDialogProps) {
  const { toast } = useToast();
  const [sharePassword, setSharePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [prevGuideId, setPrevGuideId] = useState<number | null>(null);

  const { data: shareSettings, refetch: refetchShare } = useQuery({
    queryKey: ['/api/guides', guideId, 'share'],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/guides/${guideId}/share`, { credentials: 'include' });
        if (!res.ok) {
          return { enabled: false, hasPassword: false, shareUrl: null, accessCount: 0, lastAccessedAt: null };
        }
        const data = await res.json();
        return {
          enabled: data.enabled ?? false,
          hasPassword: data.hasPassword ?? false,
          shareUrl: data.shareUrl ?? null,
          accessCount: data.accessCount ?? 0,
          lastAccessedAt: data.lastAccessedAt ?? null,
        };
      } catch {
        return { enabled: false, hasPassword: false, shareUrl: null, accessCount: 0, lastAccessedAt: null };
      }
    },
    enabled: open && guideId > 0,
    staleTime: 0,
  });

  useEffect(() => {
    if (open) {
      setSharePassword("");
      setShowPassword(false);
      if (guideId !== prevGuideId) {
        setPrevGuideId(guideId);
        refetchShare();
      }
    }
  }, [open, guideId, prevGuideId, refetchShare]);

  const updateShareMutation = useMutation({
    mutationFn: async (data: { password?: string | null; enabled?: boolean }) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/share`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchShare();
      queryClient.invalidateQueries({ queryKey: ['/api/guides'] });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Flow
          </DialogTitle>
          <DialogDescription>
            Create a shareable link with optional password protection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="share-enabled" className="flex flex-col gap-1">
              <span>Enable sharing</span>
              <span className="font-normal text-muted-foreground text-sm">
                Anyone with the link can view this flow
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
  );
}
