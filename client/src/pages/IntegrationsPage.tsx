import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plug, Webhook, Zap, Plus, Settings, Trash2, Play, Pause, 
  CheckCircle, XCircle, Clock, Activity, BarChart3, Mail,
  MessageSquare, Calendar, FileText, ExternalLink
} from "lucide-react";
import { SiSlack, SiNotion, SiJira, SiGoogleanalytics } from "react-icons/si";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

const INTEGRATION_PROVIDERS = [
  { id: "slack", name: "Slack", icon: SiSlack, description: "Send notifications to Slack channels", category: "communication" },
  { id: "microsoft_teams", name: "Microsoft Teams", icon: MessageSquare, description: "Push updates to Teams channels", category: "communication" },
  { id: "email", name: "Email (SendGrid)", icon: Mail, description: "Send email notifications", category: "communication" },
  { id: "jira", name: "Jira", icon: SiJira, description: "Create tasks and track progress", category: "project" },
  { id: "clickup", name: "ClickUp", icon: Calendar, description: "Sync tasks with ClickUp boards", category: "project" },
  { id: "monday", name: "Monday.com", icon: Calendar, description: "Connect to Monday boards", category: "project" },
  { id: "notion", name: "Notion", icon: SiNotion, description: "Push guides to Notion pages", category: "content" },
  { id: "confluence", name: "Confluence", icon: FileText, description: "Sync to Confluence spaces", category: "content" },
  { id: "google_analytics", name: "Google Analytics", icon: SiGoogleanalytics, description: "Track guide usage", category: "analytics" },
  { id: "mixpanel", name: "Mixpanel", icon: BarChart3, description: "Analytics and user tracking", category: "analytics" },
];

const AUTOMATION_TRIGGERS = [
  { id: "guide_created", label: "Guide Created", description: "When a new guide is created" },
  { id: "guide_published", label: "Guide Published", description: "When a guide is published" },
  { id: "guide_completed", label: "Guide Completed", description: "When a user completes a guide" },
  { id: "step_completed", label: "Step Completed", description: "When a step is marked complete" },
  { id: "step_assigned", label: "Step Assigned", description: "When a step is assigned to someone" },
  { id: "approval_requested", label: "Approval Requested", description: "When approval is requested" },
  { id: "approval_approved", label: "Approval Approved", description: "When a guide is approved" },
  { id: "comment_added", label: "Comment Added", description: "When a comment is added" },
  { id: "user_joined", label: "User Joined", description: "When a user joins the workspace" },
];

const AUTOMATION_ACTIONS = [
  { id: "send_email", label: "Send Email", icon: Mail },
  { id: "send_slack", label: "Send Slack Message", icon: SiSlack },
  { id: "trigger_webhook", label: "Trigger Webhook", icon: Webhook },
  { id: "notify_user", label: "Send Notification", icon: MessageSquare },
];

export default function IntegrationsPage() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id;
  const { isCollapsed } = useSidebarState();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("integrations");
  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showAddAutomation, setShowAddAutomation] = useState(false);

  const { data: integrationsData, isLoading: integrationsLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'integrations'],
    enabled: !!workspaceId,
  });

  const { data: webhooksData, isLoading: webhooksLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'webhooks'],
    enabled: !!workspaceId,
  });

  const { data: automationsData, isLoading: automationsLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'automations'],
    enabled: !!workspaceId,
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; events: string[] }) => {
      return apiRequest('POST', `/api/workspaces/${workspaceId}/webhooks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'webhooks'] });
      setShowAddWebhook(false);
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/workspaces/${workspaceId}/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'webhooks'] });
    },
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (data: { name: string; trigger: string; actions: unknown[] }) => {
      return apiRequest('POST', `/api/workspaces/${workspaceId}/automations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'automations'] });
      setShowAddAutomation(false);
    },
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest('PUT', `/api/workspaces/${workspaceId}/automations/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'automations'] });
    },
  });

  const integrations = integrationsData?.data || [];
  const webhooks = webhooksData?.data || [];
  const automations = automationsData?.data || [];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <MobileMenuTrigger />
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Integrations</h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">Connect your workspace to external services</p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="integrations" className="gap-2" data-testid="tab-integrations">
                <Plug className="h-4 w-4 hidden sm:block" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-2" data-testid="tab-webhooks">
                <Webhook className="h-4 w-4 hidden sm:block" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="automations" className="gap-2" data-testid="tab-automations">
                <Zap className="h-4 w-4 hidden sm:block" />
                Automations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="integrations" className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Connected Services</h2>
                  <p className="text-sm text-muted-foreground">Manage your third-party integrations</p>
                </div>
                <Dialog open={showAddIntegration} onOpenChange={setShowAddIntegration}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-integration">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Integration
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Integration</DialogTitle>
                      <DialogDescription>
                        Connect your workspace to external services
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                      {INTEGRATION_PROVIDERS.map((provider) => (
                        <Card 
                          key={provider.id} 
                          className="cursor-pointer hover-elevate"
                          data-testid={`integration-provider-${provider.id}`}
                        >
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <provider.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm">{provider.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {provider.category}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddIntegration(false)}>
                        Cancel
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {integrationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : integrations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No integrations connected</h3>
                    <p className="text-muted-foreground mb-4">Connect your first integration to sync with external services</p>
                    <Button onClick={() => setShowAddIntegration(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Integration
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {integrations.map((integration: any) => (
                    <Card key={integration.id} data-testid={`integration-${integration.id}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Plug className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium">{integration.name}</h3>
                            <p className="text-sm text-muted-foreground">{integration.provider}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                            {integration.status}
                          </Badge>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Webhooks</h2>
                  <p className="text-sm text-muted-foreground">Send real-time data to external URLs</p>
                </div>
                <WebhookDialog 
                  open={showAddWebhook} 
                  onOpenChange={setShowAddWebhook}
                  onSubmit={(data) => createWebhookMutation.mutate(data)}
                  isPending={createWebhookMutation.isPending}
                />
              </div>

              {webhooksLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : webhooks.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No webhooks configured</h3>
                    <p className="text-muted-foreground mb-4">Create webhooks to send data to external systems</p>
                    <Button onClick={() => setShowAddWebhook(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Webhook
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {webhooks.map((webhook: any) => (
                    <Card key={webhook.id} data-testid={`webhook-${webhook.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <Webhook className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-medium">{webhook.name}</h3>
                              <p className="text-sm text-muted-foreground truncate max-w-xs">{webhook.url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                              {webhook.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Events: {webhook.events?.join(', ')}</span>
                          {webhook.lastTriggeredAt && (
                            <span>Last triggered: {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="automations" className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Automations</h2>
                  <p className="text-sm text-muted-foreground">Create automated workflows based on events</p>
                </div>
                <AutomationDialog
                  open={showAddAutomation}
                  onOpenChange={setShowAddAutomation}
                  onSubmit={(data) => createAutomationMutation.mutate(data)}
                  isPending={createAutomationMutation.isPending}
                />
              </div>

              {automationsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : automations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No automations created</h3>
                    <p className="text-muted-foreground mb-4">Automate workflows based on guide events</p>
                    <Button onClick={() => setShowAddAutomation(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Automation
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {automations.map((automation: any) => (
                    <Card key={automation.id} data-testid={`automation-${automation.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              automation.isActive ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                            )}>
                              <Zap className={cn(
                                "h-5 w-5",
                                automation.isActive ? "text-green-600" : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <h3 className="font-medium">{automation.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Trigger: {automation.trigger}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={automation.isActive}
                              onCheckedChange={(checked) => 
                                toggleAutomationMutation.mutate({ id: automation.id, isActive: checked })
                              }
                            />
                            <Button variant="ghost" size="icon">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {automation.runCount || 0} runs
                          </span>
                          {automation.lastRunAt && (
                            <span>Last run: {formatDistanceToNow(new Date(automation.lastRunAt), { addSuffix: true })}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function WebhookDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; url: string; events: string[] }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);

  const handleSubmit = () => {
    if (name && url && events.length > 0) {
      onSubmit({ name, url, events });
      setName('');
      setUrl('');
      setEvents([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-webhook">
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
          <DialogDescription>
            Send POST requests to an external URL when events occur
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input 
              id="webhook-name"
              placeholder="My Webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-webhook-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input 
              id="webhook-url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-webhook-url"
            />
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {AUTOMATION_TRIGGERS.map((trigger) => (
                <label 
                  key={trigger.id} 
                  className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(trigger.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEvents([...events, trigger.id]);
                      } else {
                        setEvents(events.filter(ev => ev !== trigger.id));
                      }
                    }}
                    className="rounded"
                  />
                  {trigger.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !name || !url || events.length === 0}
            data-testid="button-save-webhook"
          >
            {isPending ? 'Creating...' : 'Create Webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutomationDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isPending 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; trigger: string; actions: unknown[] }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [actionType, setActionType] = useState('');

  const handleSubmit = () => {
    if (name && trigger && actionType) {
      onSubmit({ 
        name, 
        trigger, 
        actions: [{ type: actionType, config: {} }] 
      });
      setName('');
      setTrigger('');
      setActionType('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-automation">
          <Plus className="h-4 w-4 mr-2" />
          Create Automation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Automation</DialogTitle>
          <DialogDescription>
            Automatically perform actions when events occur
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="automation-name">Name</Label>
            <Input 
              id="automation-name"
              placeholder="My Automation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-automation-name"
            />
          </div>
          <div className="space-y-2">
            <Label>When this happens...</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger data-testid="select-automation-trigger">
                <SelectValue placeholder="Select a trigger" />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_TRIGGERS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Do this...</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger data-testid="select-automation-action">
                <SelectValue placeholder="Select an action" />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_ACTIONS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !name || !trigger || !actionType}
            data-testid="button-save-automation"
          >
            {isPending ? 'Creating...' : 'Create Automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
