import { Sidebar, useSidebarState } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { 
  Shield, Sparkles, Globe, Eye, EyeOff, Mail, Phone, Key, 
  Save, Loader2, Palette, Link2
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceSettings {
  id: number;
  workspaceId: number;
  autoRedactEmails: boolean;
  autoRedactPasswords: boolean;
  autoRedactPhones: boolean;
  autoRedactCustomPatterns: string[] | null;
  defaultLanguage: string;
  enableAiDescriptions: boolean;
  enableAiVoiceover: boolean;
  brandColor: string | null;
  customDomain: string | null;
}

export default function WorkspaceSettingsPage() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.[0];
  const { toast } = useToast();
  const { isCollapsed } = useSidebarState();

  const { data: settings, isLoading } = useQuery<WorkspaceSettings>({
    queryKey: ['/api/workspaces', activeWorkspace?.id, 'settings'],
    enabled: !!activeWorkspace?.id,
  });

  const [formData, setFormData] = useState<Partial<WorkspaceSettings>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async (data: Partial<WorkspaceSettings>) => {
      const response = await apiRequest('PATCH', `/api/workspaces/${activeWorkspace?.id}/settings`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', activeWorkspace?.id, 'settings'] });
      toast({
        title: "Settings saved",
        description: "Your workspace settings have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof WorkspaceSettings, value: boolean) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  if (!activeWorkspace) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <main className={cn(
          "flex-1 p-8 transition-all duration-200",
          isCollapsed ? "ml-16" : "ml-64"
        )}>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Please select a workspace first</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-8 transition-all duration-200",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-workspace-settings-title">
                Workspace Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure settings for {activeWorkspace.name}
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={updateSettings.isPending}
              data-testid="button-save-settings"
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>

          <div className="space-y-6">
            <Card data-testid="card-smart-redaction">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Smart Redaction
                </CardTitle>
                <CardDescription>
                  Automatically blur or mask sensitive information in screenshots
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <Label htmlFor="redact-emails" className="text-base">Auto-redact emails</Label>
                      <p className="text-sm text-muted-foreground">Blur email addresses in screenshots</p>
                    </div>
                  </div>
                  <Switch
                    id="redact-emails"
                    checked={formData.autoRedactEmails ?? false}
                    onCheckedChange={(checked) => handleToggle('autoRedactEmails', checked)}
                    data-testid="switch-redact-emails"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Key className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <Label htmlFor="redact-passwords" className="text-base">Auto-redact passwords</Label>
                      <p className="text-sm text-muted-foreground">Blur password fields in screenshots</p>
                    </div>
                  </div>
                  <Switch
                    id="redact-passwords"
                    checked={formData.autoRedactPasswords ?? true}
                    onCheckedChange={(checked) => handleToggle('autoRedactPasswords', checked)}
                    data-testid="switch-redact-passwords"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <Label htmlFor="redact-phones" className="text-base">Auto-redact phone numbers</Label>
                      <p className="text-sm text-muted-foreground">Blur phone numbers in screenshots</p>
                    </div>
                  </div>
                  <Switch
                    id="redact-phones"
                    checked={formData.autoRedactPhones ?? false}
                    onCheckedChange={(checked) => handleToggle('autoRedactPhones', checked)}
                    data-testid="switch-redact-phones"
                  />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-ai-features">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Features
                </CardTitle>
                <CardDescription>
                  Configure AI-powered enhancements for your guides
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <Label htmlFor="ai-descriptions" className="text-base">AI Step Descriptions</Label>
                      <p className="text-sm text-muted-foreground">Auto-generate descriptions for each step</p>
                    </div>
                  </div>
                  <Switch
                    id="ai-descriptions"
                    checked={formData.enableAiDescriptions ?? true}
                    onCheckedChange={(checked) => handleToggle('enableAiDescriptions', checked)}
                    data-testid="switch-ai-descriptions"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <Label htmlFor="ai-voiceover" className="text-base">AI Voiceover</Label>
                      <p className="text-sm text-muted-foreground">Generate audio narration for guides</p>
                    </div>
                  </div>
                  <Switch
                    id="ai-voiceover"
                    checked={formData.enableAiVoiceover ?? false}
                    onCheckedChange={(checked) => handleToggle('enableAiVoiceover', checked)}
                    data-testid="switch-ai-voiceover"
                  />
                </div>

                <div className="pt-4 border-t">
                  <Label htmlFor="default-language" className="text-base mb-2 block">Default Language</Label>
                  <Input
                    id="default-language"
                    value={formData.defaultLanguage || 'en'}
                    onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value })}
                    placeholder="en"
                    className="max-w-xs"
                    data-testid="input-default-language"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Language code for AI-generated content</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-branding">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Branding
                </CardTitle>
                <CardDescription>
                  Customize the look and feel of your public guides
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="brand-color" className="text-base mb-2 block">Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="brand-color"
                      type="color"
                      value={formData.brandColor || '#6366f1'}
                      onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                      data-testid="input-brand-color"
                    />
                    <Input
                      value={formData.brandColor || '#6366f1'}
                      onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                      placeholder="#6366f1"
                      className="max-w-32"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="custom-domain" className="text-base mb-2 block flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Custom Domain
                  </Label>
                  <Input
                    id="custom-domain"
                    value={formData.customDomain || ''}
                    onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                    placeholder="docs.yourcompany.com"
                    className="max-w-md"
                    data-testid="input-custom-domain"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Host your public guides on your own domain (Enterprise feature)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
