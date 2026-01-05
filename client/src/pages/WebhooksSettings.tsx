import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Webhook, Plus, Trash2, Copy, Eye, EyeOff, 
  Settings2, CheckCircle, XCircle, Loader2, ExternalLink
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface WebhookData {
  id: number;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
}

const WEBHOOK_EVENTS = [
  { id: 'guide_created', label: 'Guide Created', description: 'When a new guide is created' },
  { id: 'guide_published', label: 'Guide Published', description: 'When a guide is published' },
  { id: 'guide_viewed', label: 'Guide Viewed', description: 'When someone views a guide' },
  { id: 'guide_completed', label: 'Guide Completed', description: 'When someone finishes a guide' },
  { id: 'step_completed', label: 'Step Completed', description: 'When a step is marked complete' },
  { id: 'comment_added', label: 'Comment Added', description: 'When a comment is added' },
];

export default function WebhooksSettings() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.[0];
  const { isCollapsed } = useSidebarState();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: [] as string[] });
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});

  const { data: webhooks = [], isLoading, refetch } = useQuery<WebhookData[]>({
    queryKey: ['/api/webhooks', activeWorkspace?.id],
    queryFn: async () => {
      const res = await fetch(`/api/webhooks?workspaceId=${activeWorkspace?.id}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeWorkspace?.id,
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: typeof newWebhook) => {
      const res = await apiRequest('POST', '/api/webhooks', {
        ...data,
        workspaceId: activeWorkspace?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Webhook created successfully" });
      refetch();
      setCreateDialogOpen(false);
      setNewWebhook({ name: '', url: '', events: [] });
    },
    onError: () => {
      toast({ title: "Failed to create webhook", variant: "destructive" });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest('PATCH', `/api/webhooks/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/webhooks/${id}`, {});
    },
    onSuccess: () => {
      toast({ title: "Webhook deleted" });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to delete webhook", variant: "destructive" });
    },
  });

  const toggleEvent = (eventId: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: "Secret copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <MobileMenuTrigger />
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-webhooks-title">Webhooks</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Send real-time notifications to external services when events occur
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-webhook">
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && webhooks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Webhook className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-semibold mb-2">No webhooks configured</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create a webhook to send notifications to Slack, Teams, or your own services
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Webhook
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <Card key={webhook.id} data-testid={`webhook-card-${webhook.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{webhook.name}</CardTitle>
                        <Badge variant={webhook.isActive ? "default" : "secondary"}>
                          {webhook.isActive ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                          )}
                        </Badge>
                        {webhook.failureCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {webhook.failureCount} failures
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1 flex items-center gap-1 truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {webhook.url}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.isActive}
                        onCheckedChange={(checked) => 
                          toggleWebhookMutation.mutate({ id: webhook.id, isActive: checked })
                        }
                        data-testid={`switch-webhook-${webhook.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                        data-testid={`button-delete-webhook-${webhook.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Events</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {webhook.secret && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Signing Secret</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono truncate">
                            {showSecrets[webhook.id] ? webhook.secret : '••••••••••••••••••••'}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setShowSecrets(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}
                          >
                            {showSecrets[webhook.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copySecret(webhook.secret!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {webhook.lastTriggeredAt && (
                      <p className="text-xs text-muted-foreground">
                        Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure a new webhook to receive notifications when events occur in your workspace.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                placeholder="My Webhook"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                data-testid="input-webhook-name"
              />
            </div>
            
            <div>
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhook"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                data-testid="input-webhook-url"
              />
            </div>

            <div>
              <Label className="mb-2 block">Events to Subscribe</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {WEBHOOK_EVENTS.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => toggleEvent(event.id)}
                  >
                    <Checkbox
                      checked={newWebhook.events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                      data-testid={`checkbox-event-${event.id}`}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{event.label}</div>
                      <div className="text-xs text-muted-foreground">{event.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createWebhookMutation.mutate(newWebhook)}
              disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0 || createWebhookMutation.isPending}
              data-testid="button-confirm-create-webhook"
            >
              {createWebhookMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="h-4 w-4 mr-2" />
              )}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
