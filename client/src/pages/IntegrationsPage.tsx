import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar, SidebarProvider, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
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
  MessageSquare, Calendar, FileText, ExternalLink, Sparkles, Bot
} from "lucide-react";
import { SiSlack, SiNotion, SiJira, SiGoogleanalytics } from "react-icons/si";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

const INTEGRATION_PROVIDERS = [
  { id: "slack", name: "Slack", icon: SiSlack, description: "Send notifications to Slack channels", category: "communication" },
  { id: "microsoft_teams", name: "Microsoft Teams", icon: MessageSquare, description: "Push updates to Teams channels", category: "communication" },
  { id: "email", name: "Email (SendGrid)", icon: Mail, description: "Send email notifications", category: "communication" },
  { id: "jira", name: "Jira", icon: SiJira, description: "Create Jira issues from flows", category: "project" },
  { id: "trello", name: "Trello", icon: Calendar, description: "Create cards in Trello boards", category: "project" },
  { id: "asana", name: "Asana", icon: Calendar, description: "Create tasks in Asana projects", category: "project" },
  { id: "notion", name: "Notion", icon: SiNotion, description: "Sync flows to Notion pages", category: "content" },
  { id: "confluence", name: "Confluence", icon: FileText, description: "Publish to Confluence spaces", category: "content" },
  { id: "google_drive", name: "Google Drive", icon: FileText, description: "Export flows to Google Drive", category: "content" },
  { id: "hubspot", name: "HubSpot", icon: BarChart3, description: "Sync documentation to HubSpot", category: "analytics" },
  { id: "mixpanel", name: "Mixpanel", icon: BarChart3, description: "Track flow analytics", category: "analytics" },
];

const AUTOMATION_TRIGGERS = [
  { id: "guide_created", label: "Flow Created", description: "When a new flow is created" },
  { id: "guide_published", label: "Flow Published", description: "When a flow is published" },
  { id: "guide_completed", label: "Flow Completed", description: "When a user completes a flow" },
  { id: "step_completed", label: "Step Completed", description: "When a step is marked complete" },
  { id: "step_assigned", label: "Step Assigned", description: "When a step is assigned to someone" },
  { id: "approval_requested", label: "Approval Requested", description: "When approval is requested" },
  { id: "approval_approved", label: "Approval Approved", description: "When a flow is approved" },
  { id: "comment_added", label: "Comment Added", description: "When a comment is added" },
  { id: "user_joined", label: "User Joined", description: "When a user joins the workspace" },
];

const AUTOMATION_ACTIONS = [
  { id: "send_email", label: "Send Email", icon: Mail },
  { id: "send_slack", label: "Send Slack Message", icon: SiSlack },
  { id: "trigger_webhook", label: "Trigger Webhook", icon: Webhook },
  { id: "notify_user", label: "Send Notification", icon: MessageSquare },
];

function IntegrationsPageContent() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id;
  const { isCollapsed } = useSidebarState();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("integrations");
  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showAddAutomation, setShowAddAutomation] = useState(false);
  const [configureProvider, setConfigureProvider] = useState<typeof INTEGRATION_PROVIDERS[0] | null>(null);

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

  const { data: aiStatus, isLoading: aiStatusLoading } = useQuery<{
    openai: { configured: boolean; model: string };
    translation: { enabled: boolean; supportedLanguages: number };
  }>({
    queryKey: ['/api/integrations/ai-status'],
  });

  // Validate credentials before saving
  const validateCredentialsMutation = useMutation({
    mutationFn: async (data: { provider: string; config: Record<string, string> }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/integrations/validate`, data);
      return response.json();
    },
  });

  // Create integration (validates first, then saves)
  const createIntegrationMutation = useMutation({
    mutationFn: async (data: { name: string; provider: string; config: Record<string, string> }) => {
      // First validate credentials
      const validateResponse = await apiRequest('POST', `/api/workspaces/${workspaceId}/integrations/validate`, {
        provider: data.provider,
        config: data.config
      });
      const validationResult = await validateResponse.json();
      
      if (!validationResult.success) {
        throw new Error(validationResult.message || 'Credential validation failed');
      }
      
      // If valid, create the integration with credentials field for database
      return apiRequest('POST', `/api/workspaces/${workspaceId}/integrations`, {
        name: data.name,
        provider: data.provider,
        credentials: data.config,
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'integrations'] });
      setConfigureProvider(null);
      setShowAddIntegration(false);
    },
  });

  // Test an existing integration
  const testIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/integrations/${id}/test`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'integrations'] });
    },
  });

  const toggleIntegrationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'inactive' }) => {
      return apiRequest('PUT', `/api/workspaces/${workspaceId}/integrations/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'integrations'] });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/workspaces/${workspaceId}/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'integrations'] });
    },
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

  const handleProviderClick = (provider: typeof INTEGRATION_PROVIDERS[0]) => {
    setConfigureProvider(provider);
  };

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
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="integrations" className="gap-2" data-testid="tab-integrations">
                <Plug className="h-4 w-4 hidden sm:block" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2" data-testid="tab-ai-services">
                <Sparkles className="h-4 w-4 hidden sm:block" />
                AI Services
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
                          onClick={() => handleProviderClick(provider)}
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

                <IntegrationConfigDialog
                  provider={configureProvider}
                  onClose={() => setConfigureProvider(null)}
                  onSubmit={(data) => createIntegrationMutation.mutate(data)}
                  isPending={createIntegrationMutation.isPending}
                />
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
                  {integrations.map((integration: any) => {
                    const provider = INTEGRATION_PROVIDERS.find(p => p.id === integration.provider);
                    const ProviderIcon = provider?.icon || Plug;
                    return (
                      <Card key={integration.id} data-testid={`integration-${integration.id}`}>
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              integration.status === 'active' ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                            )}>
                              <ProviderIcon className={cn(
                                "h-5 w-5",
                                integration.status === 'active' ? "text-green-600" : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <h3 className="font-medium">{integration.name}</h3>
                              <p className="text-sm text-muted-foreground">{provider?.name || integration.provider}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {integration.status === 'error' && (
                              <Badge variant="destructive" className="text-xs">
                                Error
                              </Badge>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => testIntegrationMutation.mutate(integration.id)}
                              disabled={testIntegrationMutation.isPending}
                              data-testid={`test-integration-${integration.id}`}
                            >
                              {testIntegrationMutation.isPending ? (
                                <Activity className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                              <span className="ml-1 hidden sm:inline">Test</span>
                            </Button>
                            <Switch
                              checked={integration.status === 'active'}
                              onCheckedChange={(checked) => 
                                toggleIntegrationMutation.mutate({ 
                                  id: integration.id, 
                                  status: checked ? 'active' : 'inactive' 
                                })
                              }
                              data-testid={`toggle-integration-${integration.id}`}
                            />
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteIntegrationMutation.mutate(integration.id)}
                              data-testid={`delete-integration-${integration.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">AI Services Status</h2>
                <p className="text-sm text-muted-foreground">View the status of AI-powered features</p>
              </div>

              {aiStatusLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Bot className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">OpenAI Integration</CardTitle>
                            <CardDescription>AI-powered features</CardDescription>
                          </div>
                        </div>
                        <Badge 
                          variant={aiStatus?.openai?.configured ? "default" : "secondary"}
                          className={aiStatus?.openai?.configured 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : ""}
                        >
                          {aiStatus?.openai?.configured ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Not Configured</>
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Model</span>
                          <span className="font-medium">{aiStatus?.openai?.model || "gpt-4o"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Features</span>
                          <span className="font-medium">Step descriptions, Translations</span>
                        </div>
                      </div>
                      {!aiStatus?.openai?.configured && (
                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                          <p className="text-muted-foreground">
                            The OpenAI API key is managed securely through environment variables. 
                            Contact your administrator to configure this integration.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Translation Service</CardTitle>
                            <CardDescription>Multi-language support</CardDescription>
                          </div>
                        </div>
                        <Badge 
                          variant={aiStatus?.translation?.enabled ? "default" : "secondary"}
                          className={aiStatus?.translation?.enabled 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : ""}
                        >
                          {aiStatus?.translation?.enabled ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Enabled</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Requires OpenAI</>
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Supported Languages</span>
                          <span className="font-medium">{aiStatus?.translation?.supportedLanguages || 15}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Translation Quality</span>
                          <span className="font-medium">High (GPT-4o)</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Translations are powered by OpenAI and support Spanish, French, German, Portuguese, 
                        Italian, Dutch, Polish, Russian, Japanese, Korean, Chinese, Arabic, Hindi, and Turkish.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardContent className="py-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <Settings className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Security Note</h3>
                      <p className="text-sm text-muted-foreground">
                        AI service credentials are managed through Replit's secure secrets system. 
                        API keys are never exposed in the application interface for security reasons. 
                        All AI operations are processed server-side with encrypted connections.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

const PROVIDER_FIELDS: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  slack: [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
    { key: 'channel', label: 'Default Channel (optional)', placeholder: '#general' },
  ],
  microsoft_teams: [
    { key: 'webhookUrl', label: 'Incoming Webhook URL', placeholder: 'https://outlook.office.com/webhook/...' },
  ],
  email: [
    { key: 'apiKey', label: 'SendGrid API Key', placeholder: 'SG.xxxx...', type: 'password' },
    { key: 'fromEmail', label: 'From Email', placeholder: 'noreply@yourcompany.com' },
  ],
  jira: [
    { key: 'domain', label: 'Jira Domain', placeholder: 'yourcompany.atlassian.net' },
    { key: 'email', label: 'Email', placeholder: 'your-email@company.com' },
    { key: 'apiToken', label: 'API Token', placeholder: 'Your Jira API token', type: 'password' },
    { key: 'projectKey', label: 'Default Project Key', placeholder: 'PROJ' },
    { key: 'issueType', label: 'Issue Type', placeholder: 'Task' },
  ],
  trello: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Trello API key', type: 'password' },
    { key: 'apiToken', label: 'API Token', placeholder: 'Your Trello token', type: 'password' },
    { key: 'listId', label: 'List ID', placeholder: 'The ID of the list to add cards to' },
  ],
  asana: [
    { key: 'accessToken', label: 'Personal Access Token', placeholder: 'Your Asana access token', type: 'password' },
    { key: 'projectId', label: 'Project ID', placeholder: 'Your Asana project ID' },
  ],
  notion: [
    { key: 'apiKey', label: 'Integration Token', placeholder: 'secret_xxxx...', type: 'password' },
    { key: 'databaseId', label: 'Database ID (optional)', placeholder: 'abc123...' },
    { key: 'parentPageId', label: 'Parent Page ID (if no database)', placeholder: 'abc123...' },
  ],
  confluence: [
    { key: 'domain', label: 'Confluence Domain', placeholder: 'yourcompany.atlassian.net' },
    { key: 'email', label: 'Email', placeholder: 'your-email@company.com' },
    { key: 'apiToken', label: 'API Token', placeholder: 'Your Confluence API token', type: 'password' },
    { key: 'spaceKey', label: 'Default Space Key', placeholder: 'DOCS' },
  ],
  google_drive: [
    { key: 'accessToken', label: 'OAuth Access Token', placeholder: 'Your Google OAuth token', type: 'password' },
    { key: 'folderId', label: 'Folder ID (optional)', placeholder: 'Target folder ID' },
  ],
  hubspot: [
    { key: 'accessToken', label: 'Private App Token', placeholder: 'Your HubSpot token', type: 'password' },
  ],
  mixpanel: [
    { key: 'projectToken', label: 'Project Token', placeholder: 'Your Mixpanel project token', type: 'password' },
  ],
};

function IntegrationConfigDialog({ 
  provider, 
  onClose, 
  onSubmit, 
  isPending 
}: { 
  provider: typeof INTEGRATION_PROVIDERS[0] | null;
  onClose: () => void;
  onSubmit: (data: { name: string; provider: string; config: Record<string, string> }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});

  const fields = provider ? PROVIDER_FIELDS[provider.id] || [] : [];

  const handleSubmit = () => {
    if (provider && name) {
      onSubmit({ name, provider: provider.id, config });
      setName('');
      setConfig({});
    }
  };

  const handleClose = () => {
    setName('');
    setConfig({});
    onClose();
  };

  const isValid = name && fields.every(field => config[field.key]?.trim());

  if (!provider) return null;

  return (
    <Dialog open={!!provider} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <provider.icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Configure {provider.name}</DialogTitle>
              <DialogDescription>{provider.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="integration-name">Integration Name</Label>
            <Input 
              id="integration-name"
              placeholder={`My ${provider.name} Integration`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-integration-name"
            />
          </div>
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
              <Input 
                id={`field-${field.key}`}
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                data-testid={`input-${field.key}`}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !isValid}
            data-testid="button-save-integration"
          >
            {isPending ? 'Connecting...' : 'Connect Integration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function IntegrationsPage() {
  return (
    <SidebarProvider>
      <IntegrationsPageContent />
    </SidebarProvider>
  );
}
