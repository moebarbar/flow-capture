import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, CreditCard, FileText, TrendingUp, Shield, Plus, Pencil, Trash2, BookOpen, Palette, Code, DollarSign, Tag, Image, ExternalLink, Mail, Download, Send, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalGuides: number;
  activeSubscriptions: number;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
}

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  status: string;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SiteSettings {
  id?: number;
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string;
  siteDescription: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headScripts: string | null;
  bodyScripts: string | null;
  customCss: string | null;
  extensionLink: string | null;
  demoLink: string | null;
  pricingLink: string | null;
  docsLink: string | null;
}

interface DiscountCode {
  id: number;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  currency: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}

interface FinanceOverview {
  mrr: number;
  arr: number;
  totalRevenue: number;
  recentRevenue: number;
  activeSubscriptionCount: number;
  totalInvoices: number;
  paidInvoices: number;
}

interface ContentPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  metaDescription: string | null;
  status: string;
  showInFooter: boolean;
  footerOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function BlogPostEditor({ post, onClose }: { post?: BlogPost; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post?.featuredImageUrl || '');
  const [status, setStatus] = useState(post?.status || 'draft');
  const [uploading, setUploading] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (post) {
        return apiRequest('PATCH', `/api/admin/blog-posts/${post.id}`, data);
      } else {
        return apiRequest('POST', '/api/admin/blog-posts', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog-posts'] });
      toast({ title: post ? "Post updated" : "Post created" });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to save post", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const finalSlug = slug || generateSlug(title);
    saveMutation.mutate({
      title,
      slug: finalSlug,
      content,
      excerpt: excerpt || null,
      featuredImageUrl: featuredImageUrl || null,
      status,
      publishedAt: status === 'published' && !post?.publishedAt ? new Date().toISOString() : post?.publishedAt,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const presignRes = await fetch(`/api/object-storage/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&visibility=public`);
      const { url, objectPath } = await presignRes.json();
      
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      const publicUrl = `/api/object-storage/public/${objectPath}`;
      setFeaturedImageUrl(publicUrl);
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!post) setSlug(generateSlug(e.target.value));
          }}
          placeholder="Enter post title"
          data-testid="input-post-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="post-url-slug"
          data-testid="input-post-slug"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea
          id="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Brief description of the post..."
          className="min-h-[60px]"
          data-testid="input-post-excerpt"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your blog post content here..."
          className="min-h-[200px]"
          data-testid="input-post-content"
        />
      </div>

      <div className="space-y-2">
        <Label>Featured Image</Label>
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="max-w-[200px]"
            data-testid="input-post-image"
          />
          {featuredImageUrl && (
            <div className="relative w-20 h-20 rounded-md overflow-hidden border">
              <img src={featuredImageUrl} alt="Featured" className="w-full h-full object-cover" />
            </div>
          )}
          {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-post-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-post">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-post">
          {saveMutation.isPending ? 'Saving...' : (post ? 'Update Post' : 'Create Post')}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ContentPageEditor({ page, onClose }: { page?: ContentPage; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content || '');
  const [slug, setSlug] = useState(page?.slug || '');
  const [metaDescription, setMetaDescription] = useState(page?.metaDescription || '');
  const [status, setStatus] = useState(page?.status || 'draft');
  const [showInFooter, setShowInFooter] = useState(page?.showInFooter ?? true);
  const [footerOrder, setFooterOrder] = useState(page?.footerOrder || 0);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (page) {
        return apiRequest('PATCH', `/api/admin/content-pages/${page.id}`, data);
      } else {
        return apiRequest('POST', '/api/admin/content-pages', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-pages'] });
      toast({ title: page ? "Page updated" : "Page created" });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Failed to save page", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!title || !slug || !content) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      title,
      slug,
      content,
      metaDescription: metaDescription || null,
      status,
      showInFooter,
      footerOrder,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="page-title">Title</Label>
        <Input
          id="page-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!page) setSlug(generateSlug(e.target.value));
          }}
          placeholder="Enter page title"
          data-testid="input-page-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="page-slug">URL Slug</Label>
        <Input
          id="page-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="page-url-slug"
          data-testid="input-page-slug"
        />
        <p className="text-xs text-muted-foreground">This will appear as: /pages/{slug || 'your-slug'}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="page-meta">Meta Description (SEO)</Label>
        <Textarea
          id="page-meta"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Brief description for search engines..."
          className="min-h-[60px]"
          data-testid="input-page-meta"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="page-content">Content (HTML)</Label>
        <Textarea
          id="page-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter page content (HTML supported)..."
          className="min-h-[200px] font-mono text-sm"
          data-testid="input-page-content"
        />
        <p className="text-xs text-muted-foreground">HTML is supported. Common tags: h1, h2, p, ul, li, strong, em, a</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="page-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-page-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer-order">Footer Order</Label>
          <Input
            id="footer-order"
            type="number"
            value={footerOrder}
            onChange={(e) => setFooterOrder(parseInt(e.target.value) || 0)}
            placeholder="0"
            data-testid="input-footer-order"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="show-in-footer"
          checked={showInFooter}
          onCheckedChange={setShowInFooter}
          data-testid="switch-show-in-footer"
        />
        <Label htmlFor="show-in-footer">Show in footer navigation</Label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-page">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-page">
          {saveMutation.isPending ? 'Saving...' : (page ? 'Update Page' : 'Create Page')}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface EmailSettings {
  id?: number;
  sendgridApiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  enableEmailVerification?: boolean;
  welcomeEmailEnabled?: boolean;
  welcomeEmailSubject?: string | null;
  welcomeEmailBody?: string | null;
  verificationEmailSubject?: string | null;
  verificationEmailBody?: string | null;
  passwordResetEmailSubject?: string | null;
  passwordResetEmailBody?: string | null;
}

function EmailSettingsTab() {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [formData, setFormData] = useState<Partial<EmailSettings>>({});

  const { data: settings, isLoading } = useQuery<EmailSettings>({
    queryKey: ['/api/admin/email-settings'],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<EmailSettings>) => {
      return apiRequest('PUT', '/api/admin/email-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-settings'] });
      toast({ title: "Email settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', '/api/admin/email-settings/test', { email });
    },
    onSuccess: () => {
      toast({ title: "Test email sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send test email", variant: "destructive" });
    },
  });

  const currentData = { ...settings, ...formData };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SendGrid Configuration
          </CardTitle>
          <CardDescription>Configure your SendGrid API key and sender details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SendGrid API Key</Label>
              <Input
                type="password"
                value={formData.sendgridApiKey !== undefined ? formData.sendgridApiKey || '' : (settings?.sendgridApiKey === '***configured***' ? '' : settings?.sendgridApiKey || '')}
                onChange={(e) => setFormData(prev => ({ ...prev, sendgridApiKey: e.target.value }))}
                placeholder={settings?.sendgridApiKey === '***configured***' ? 'API key configured (enter new to change)' : 'SG.xxx...'}
                data-testid="input-sendgrid-key"
              />
              <p className="text-sm text-muted-foreground">
                {settings?.sendgridApiKey === '***configured***' ? 'API key is configured' : 'Enter your SendGrid API key'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={currentData.fromEmail || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, fromEmail: e.target.value }))}
                placeholder="noreply@example.com"
                data-testid="input-from-email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              value={currentData.fromName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
              placeholder="FlowCapture"
              data-testid="input-from-name"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Email Features
          </CardTitle>
          <CardDescription>Toggle email features on or off</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Verification</Label>
              <p className="text-sm text-muted-foreground">Require users to verify their email after registration</p>
            </div>
            <Switch
              checked={currentData.enableEmailVerification ?? false}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableEmailVerification: checked }))}
              data-testid="switch-email-verification"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Welcome Email</Label>
              <p className="text-sm text-muted-foreground">Send a welcome email when users register</p>
            </div>
            <Switch
              checked={currentData.welcomeEmailEnabled ?? false}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, welcomeEmailEnabled: checked }))}
              data-testid="switch-welcome-email"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Email
          </CardTitle>
          <CardDescription>Send a test email to verify your configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              data-testid="input-test-email"
            />
            <Button
              onClick={() => testEmailMutation.mutate(testEmail)}
              disabled={testEmailMutation.isPending || !testEmail}
              data-testid="button-send-test"
            >
              {testEmailMutation.isPending ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={() => saveMutation.mutate(formData)} 
        disabled={saveMutation.isPending || Object.keys(formData).length === 0}
        data-testid="button-save-email-settings"
      >
        {saveMutation.isPending ? 'Saving...' : 'Save Email Settings'}
      </Button>
    </div>
  );
}

function BrandingTab() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  
  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ['/api/admin/settings'],
  });

  const [formData, setFormData] = useState<Partial<SiteSettings>>({});

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SiteSettings>) => {
      return apiRequest('PUT', '/api/admin/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/public'] });
      toast({ title: "Branding settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'faviconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    try {
      const presignRes = await fetch(`/api/object-storage/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}&visibility=public`);
      const { url, objectPath } = await presignRes.json();
      
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      const publicUrl = `/api/object-storage/public/${objectPath}`;
      setFormData(prev => ({ ...prev, [field]: publicUrl }));
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const currentData = { ...settings, ...formData };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Site Identity
          </CardTitle>
          <CardDescription>Configure your site name, logo, and favicon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input
                value={currentData.siteName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, siteName: e.target.value }))}
                placeholder="FlowCapture"
                data-testid="input-site-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Site Description</Label>
              <Input
                value={currentData.siteDescription || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, siteDescription: e.target.value }))}
                placeholder="Automatic workflow documentation"
                data-testid="input-site-description"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'logoUrl')}
                  disabled={uploading === 'logoUrl'}
                  data-testid="input-logo"
                />
                {currentData.logoUrl && (
                  <div className="w-16 h-16 rounded border overflow-hidden">
                    <img src={currentData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Favicon</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'faviconUrl')}
                  disabled={uploading === 'faviconUrl'}
                  data-testid="input-favicon"
                />
                {currentData.faviconUrl && (
                  <div className="w-8 h-8 rounded border overflow-hidden">
                    <img src={currentData.faviconUrl} alt="Favicon" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>Set your brand colors for the landing page and app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={currentData.primaryColor || '#6366f1'}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-16 h-10 p-1"
                  data-testid="input-primary-color"
                />
                <Input
                  value={currentData.primaryColor || '#6366f1'}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="flex-1"
                  data-testid="input-primary-color-hex"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={currentData.secondaryColor || '#8b5cf6'}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-16 h-10 p-1"
                  data-testid="input-secondary-color"
                />
                <Input
                  value={currentData.secondaryColor || '#8b5cf6'}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="flex-1"
                  data-testid="input-secondary-color-hex"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={currentData.accentColor || '#06b6d4'}
                  onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-16 h-10 p-1"
                  data-testid="input-accent-color"
                />
                <Input
                  value={currentData.accentColor || '#06b6d4'}
                  onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="flex-1"
                  data-testid="input-accent-color-hex"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Landing Page Links
          </CardTitle>
          <CardDescription>Configure URLs for landing page buttons and CTAs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Get Extension Link</Label>
              <Input
                value={currentData.extensionLink || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, extensionLink: e.target.value }))}
                placeholder="https://chrome.google.com/webstore/..."
                data-testid="input-extension-link"
              />
              <p className="text-xs text-muted-foreground">Link for the "Get the Extension" button</p>
            </div>
            <div className="space-y-2">
              <Label>Demo / How It Works Link</Label>
              <Input
                value={currentData.demoLink || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, demoLink: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
                data-testid="input-demo-link"
              />
              <p className="text-xs text-muted-foreground">Link for the "See How It Works" button</p>
            </div>
            <div className="space-y-2">
              <Label>Pricing Link</Label>
              <Input
                value={currentData.pricingLink || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, pricingLink: e.target.value }))}
                placeholder="/pricing or https://..."
                data-testid="input-pricing-link"
              />
              <p className="text-xs text-muted-foreground">Link for any pricing buttons</p>
            </div>
            <div className="space-y-2">
              <Label>Documentation Link</Label>
              <Input
                value={currentData.docsLink || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, docsLink: e.target.value }))}
                placeholder="/docs or https://..."
                data-testid="input-docs-link"
              />
              <p className="text-xs text-muted-foreground">Link for documentation or help pages</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid="button-save-branding">
          {saveMutation.isPending ? 'Saving...' : 'Save Branding'}
        </Button>
      </div>
    </div>
  );
}

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  default_price?: {
    id: string;
    unit_amount: number | null;
    currency: string;
    recurring?: {
      interval: string;
    };
  };
}

interface StripePrice {
  id: string;
  product: string;
  unit_amount: number | null;
  currency: string;
  active: boolean;
  recurring?: {
    interval: string;
  };
}

function IntegrationsTab() {
  const { toast } = useToast();
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '' });
  const [newPrice, setNewPrice] = useState({ productId: '', amount: '', currency: 'usd', interval: 'month' });
  
  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ['/api/admin/settings'],
  });

  const { data: stripeProducts, isLoading: productsLoading } = useQuery<{ data: StripeProduct[] }>({
    queryKey: ['/api/admin/stripe/products'],
  });

  const { data: stripePrices } = useQuery<{ data: StripePrice[] }>({
    queryKey: ['/api/admin/stripe/prices'],
  });

  const [formData, setFormData] = useState<Partial<SiteSettings>>({});

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SiteSettings>) => {
      return apiRequest('PUT', '/api/admin/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: "Integration settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return apiRequest('POST', '/api/admin/stripe/products', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/products'] });
      toast({ title: "Product created" });
      setShowProductDialog(false);
      setNewProduct({ name: '', description: '' });
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const createPriceMutation = useMutation({
    mutationFn: async (data: { productId: string; amount: number; currency: string; interval: string }) => {
      return apiRequest('POST', '/api/admin/stripe/prices', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/prices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/products'] });
      toast({ title: "Price created" });
      setShowPriceDialog(false);
      setNewPrice({ productId: '', amount: '', currency: 'usd', interval: 'month' });
    },
    onError: () => {
      toast({ title: "Failed to create price", variant: "destructive" });
    },
  });

  const syncStripeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/admin/stripe/sync', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stripe/prices'] });
      toast({ title: "Stripe data synced" });
    },
    onError: () => {
      toast({ title: "Failed to sync Stripe data", variant: "destructive" });
    },
  });

  const currentData = { ...settings, ...formData };

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Stripe Integration
            </CardTitle>
            <CardDescription>Manage your Stripe products and pricing plans</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => syncStripeMutation.mutate()}
              disabled={syncStripeMutation.isPending}
              data-testid="button-sync-stripe"
            >
              {syncStripeMutation.isPending ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Products</h4>
              <p className="text-sm text-muted-foreground">Your subscription products</p>
            </div>
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-product">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Product</DialogTitle>
                  <DialogDescription>Add a new product to Stripe</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Product Name</Label>
                    <Input
                      value={newProduct.name}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Pro Plan"
                      data-testid="input-product-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newProduct.description}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Access to all premium features..."
                      data-testid="input-product-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowProductDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => createProductMutation.mutate(newProduct)}
                    disabled={createProductMutation.isPending || !newProduct.name}
                    data-testid="button-create-product"
                  >
                    {createProductMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {productsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : stripeProducts?.data?.length ? (
            <div className="space-y-2">
              {stripeProducts.data.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`product-${product.id}`}>
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">{product.description || 'No description'}</div>
                    {product.default_price && (
                      <Badge variant="secondary" className="mt-1">
                        ${((product.default_price.unit_amount || 0) / 100).toFixed(2)}/{product.default_price.recurring?.interval || 'one-time'}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={product.active ? 'default' : 'outline'}>
                    {product.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products found. Create one or sync from Stripe.</p>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <h4 className="font-medium">Prices</h4>
              <p className="text-sm text-muted-foreground">Pricing plans for your products</p>
            </div>
            <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-add-price">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Price
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Price</DialogTitle>
                  <DialogDescription>Add a new price to a product</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select value={newPrice.productId} onValueChange={(v) => setNewPrice(prev => ({ ...prev, productId: v }))}>
                      <SelectTrigger data-testid="select-price-product">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {stripeProducts?.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount (cents)</Label>
                      <Input
                        type="number"
                        value={newPrice.amount}
                        onChange={(e) => setNewPrice(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="1999"
                        data-testid="input-price-amount"
                      />
                      <p className="text-xs text-muted-foreground">In cents (1999 = $19.99)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Interval</Label>
                      <Select value={newPrice.interval} onValueChange={(v) => setNewPrice(prev => ({ ...prev, interval: v }))}>
                        <SelectTrigger data-testid="select-price-interval">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="month">Monthly</SelectItem>
                          <SelectItem value="year">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPriceDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => createPriceMutation.mutate({
                      productId: newPrice.productId,
                      amount: parseInt(newPrice.amount),
                      currency: newPrice.currency,
                      interval: newPrice.interval,
                    })}
                    disabled={createPriceMutation.isPending || !newPrice.productId || !newPrice.amount}
                    data-testid="button-create-price"
                  >
                    {createPriceMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {stripePrices?.data?.length ? (
            <div className="space-y-2">
              {stripePrices.data.slice(0, 10).map((price) => {
                const product = stripeProducts?.data?.find(p => p.id === price.product);
                return (
                  <div key={price.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`price-${price.id}`}>
                    <div>
                      <div className="font-medium">${((price.unit_amount || 0) / 100).toFixed(2)}/{price.recurring?.interval || 'one-time'}</div>
                      <div className="text-sm text-muted-foreground">{product?.name || price.product}</div>
                    </div>
                    <Badge variant={price.active ? 'default' : 'outline'}>
                      {price.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No prices found. Create one or sync from Stripe.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Google Analytics
          </CardTitle>
          <CardDescription>
            Track page views and user interactions with Google Analytics 4
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga-id">Measurement ID</Label>
            <Input
              id="ga-id"
              placeholder="G-XXXXXXXXXX"
              disabled
              className="font-mono"
              data-testid="input-ga-measurement-id"
            />
            <p className="text-xs text-muted-foreground">
              To add your Google Analytics Measurement ID, go to Replit Secrets and add VITE_GA_MEASUREMENT_ID with your GA4 Measurement ID (starts with "G-").
            </p>
          </div>
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">How to find your Measurement ID:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Go to your Google Analytics account</li>
              <li>Navigate to Admin &gt; Property &gt; Data Streams &gt; Web</li>
              <li>Select your web stream (or create one)</li>
              <li>Copy the Measurement ID (e.g., G-XXXXXXXXXX)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Head Scripts
          </CardTitle>
          <CardDescription>
            Add analytics, tracking pixels, or other scripts to the head section. 
            These load before page content renders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentData.headScripts || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, headScripts: e.target.value }))}
            placeholder="<!-- Google Analytics, Facebook Pixel, etc. -->"
            className="min-h-[150px] font-mono text-sm"
            data-testid="input-head-scripts"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Body Scripts
          </CardTitle>
          <CardDescription>
            Add scripts that should load at the end of the body. 
            Good for chat widgets, support tools, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentData.bodyScripts || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, bodyScripts: e.target.value }))}
            placeholder="<!-- Intercom, Crisp, Drift chat widgets, etc. -->"
            className="min-h-[150px] font-mono text-sm"
            data-testid="input-body-scripts"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
          <CardDescription>Add custom CSS styles to override default styling</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentData.customCss || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, customCss: e.target.value }))}
            placeholder="/* Custom CSS styles */"
            className="min-h-[150px] font-mono text-sm"
            data-testid="input-custom-css"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid="button-save-integrations">
          {saveMutation.isPending ? 'Saving...' : 'Save Integrations'}
        </Button>
      </div>
    </div>
  );
}

function FinanceTab() {
  const { data: overview, isLoading } = useQuery<FinanceOverview>({
    queryKey: ['/api/admin/finance/overview'],
  });

  const { data: invoicesData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/admin/invoices'],
  });

  if (isLoading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue (MRR)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-mrr">
              ${overview?.mrr?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Revenue (ARR)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-arr">
              ${overview?.arr?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Per year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              ${overview?.totalRevenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-recent-revenue">
              ${overview?.recentRevenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Recent revenue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Last 10 invoices from Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesData?.data?.slice(0, 10).map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.id?.slice(0, 20)}...</TableCell>
                  <TableCell>${((inv.amount_due || 0) / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'paid' ? 'default' : 'outline'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.created ? format(new Date(inv.created * 1000), 'MMM d, yyyy') : 'N/A'}
                  </TableCell>
                </TableRow>
              )) || (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PromotionsTab() {
  const { toast } = useToast();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | undefined>();

  const { data: codesData, isLoading } = useQuery<{ data: DiscountCode[] }>({
    queryKey: ['/api/admin/discount-codes'],
  });

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCode) {
        return apiRequest('PATCH', `/api/admin/discount-codes/${editingCode.id}`, data);
      }
      return apiRequest('POST', '/api/admin/discount-codes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discount-codes'] });
      toast({ title: editingCode ? "Discount code updated" : "Discount code created" });
      closeEditor();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to save", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/admin/discount-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/discount-codes'] });
      toast({ title: "Discount code deleted" });
    },
  });

  const openEditor = (discountCode?: DiscountCode) => {
    if (discountCode) {
      setEditingCode(discountCode);
      setCode(discountCode.code);
      setDescription(discountCode.description || '');
      setDiscountType(discountCode.discountType as 'percent' | 'fixed');
      setDiscountValue(discountCode.discountValue.toString());
      setMaxRedemptions(discountCode.maxRedemptions?.toString() || '');
      setExpiresAt(discountCode.expiresAt ? discountCode.expiresAt.split('T')[0] : '');
    } else {
      setEditingCode(undefined);
      setCode('');
      setDescription('');
      setDiscountType('percent');
      setDiscountValue('');
      setMaxRedemptions('');
      setExpiresAt('');
    }
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingCode(undefined);
  };

  const handleSave = () => {
    if (!code.trim() || !discountValue) {
      toast({ title: "Code and discount value are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      code: code.toUpperCase(),
      description: description || null,
      discountType,
      discountValue: parseInt(discountValue),
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
      expiresAt: expiresAt || null,
      status: 'active',
    });
  };

  if (isLoading) {
    return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Discount Codes
            </CardTitle>
            <CardDescription>Create and manage promotional discount codes</CardDescription>
          </div>
          <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
            <DialogTrigger asChild>
              <Button onClick={() => openEditor()} data-testid="button-new-discount">
                <Plus className="h-4 w-4 mr-2" />
                New Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCode ? 'Edit Discount Code' : 'Create Discount Code'}</DialogTitle>
                <DialogDescription>
                  Create a promotional code for your customers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SUMMER20"
                    data-testid="input-discount-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Summer sale discount"
                    data-testid="input-discount-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}>
                      <SelectTrigger data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value {discountType === 'percent' ? '(%)' : '(cents)'}</Label>
                    <Input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percent' ? '20' : '500'}
                      data-testid="input-discount-value"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Redemptions (optional)</Label>
                    <Input
                      type="number"
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value)}
                      placeholder="100"
                      data-testid="input-max-redemptions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expires (optional)</Label>
                    <Input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      data-testid="input-expires-at"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeEditor}>Cancel</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-discount">
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codesData?.data?.length ? (
                codesData.data.map((dc) => (
                  <TableRow key={dc.id} data-testid={`row-discount-${dc.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-mono font-medium">{dc.code}</div>
                        {dc.description && (
                          <div className="text-sm text-muted-foreground">{dc.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {dc.discountType === 'percent' ? `${dc.discountValue}%` : `$${(dc.discountValue / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {dc.redemptionCount}{dc.maxRedemptions ? `/${dc.maxRedemptions}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dc.status === 'active' ? 'default' : 'outline'}>
                        {dc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditor(dc)}
                          data-testid={`button-edit-discount-${dc.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Delete this discount code?')) {
                              deleteMutation.mutate(dc.id);
                            }
                          }}
                          data-testid={`button-delete-discount-${dc.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No discount codes yet. Create your first code to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PagesTab() {
  const { toast } = useToast();
  const [editingPage, setEditingPage] = useState<ContentPage | undefined>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: pagesData, isLoading } = useQuery<{ data: ContentPage[] }>({
    queryKey: ['/api/admin/content-pages'],
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/admin/content-pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-pages'] });
      toast({ title: "Page deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete page", variant: "destructive" });
    },
  });

  const openEditor = (page?: ContentPage) => {
    setEditingPage(page);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setEditingPage(undefined);
    setIsEditorOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Content Pages
          </CardTitle>
          <CardDescription>Create and manage static pages like Privacy Policy, Terms, etc.</CardDescription>
        </div>
        <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditor()} data-testid="button-new-page">
              <Plus className="h-4 w-4 mr-2" />
              New Page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPage ? 'Edit Page' : 'Create New Page'}</DialogTitle>
              <DialogDescription>
                {editingPage ? 'Update your content page' : 'Create a new page for your site (Privacy Policy, Terms, etc.)'}
              </DialogDescription>
            </DialogHeader>
            <ContentPageEditor page={editingPage} onClose={closeEditor} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Footer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagesData?.data?.length ? (
                pagesData.data.map((page) => (
                  <TableRow key={page.id} data-testid={`row-page-${page.id}`}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell className="text-muted-foreground">/pages/{page.slug}</TableCell>
                    <TableCell>
                      <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                        {page.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {page.showInFooter ? (
                        <Badge variant="outline">Order: {page.footerOrder}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Hidden</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(`/pages/${page.slug}`, '_blank')}
                          disabled={page.status !== 'published'}
                          data-testid={`button-view-page-${page.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditor(page)}
                          data-testid={`button-edit-page-${page.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this page?')) {
                              deletePageMutation.mutate(page.id);
                            }
                          }}
                          data-testid={`button-delete-page-${page.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No content pages yet. Create your first page to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ data: User[] }>({
    queryKey: ['/api/admin/users'],
  });

  const { data: blogPostsData, isLoading: postsLoading } = useQuery<{ data: BlogPost[] }>({
    queryKey: ['/api/admin/blog-posts'],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest('PATCH', `/api/admin/users/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/admin/blog-posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blog-posts'] });
      toast({ title: "Post deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete post", variant: "destructive" });
    },
  });

  const openEditor = (post?: BlogPost) => {
    setEditingPost(post);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setEditingPost(undefined);
    setIsEditorOpen(false);
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-full"><Skeleton className="h-32 w-32" /></div>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access the admin dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage your SaaS platform</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalUsers || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-subs">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.activeSubscriptions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-workspaces">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalWorkspaces || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guides</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-guides">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalGuides || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
            <TabsTrigger value="branding" data-testid="tab-branding">Branding</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="finance" data-testid="tab-finance">Finance</TabsTrigger>
            <TabsTrigger value="promotions" data-testid="tab-promotions">Promotions</TabsTrigger>
            <TabsTrigger value="blog" data-testid="tab-blog">Blog</TabsTrigger>
            <TabsTrigger value="pages" data-testid="tab-pages">Pages</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage all registered users</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/api/admin/users/export';
                  }}
                  data-testid="button-export-users"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData?.data?.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{u.firstName} {u.lastName}</div>
                              <div className="text-sm text-muted-foreground">{u.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.subscriptionStatus === 'active' ? 'default' : 'outline'}>
                              {u.subscriptionStatus || 'inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(role) => updateRoleMutation.mutate({ userId: u.id, role })}
                            >
                              <SelectTrigger className="w-24" data-testid={`select-role-${u.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <EmailSettingsTab />
          </TabsContent>

          <TabsContent value="branding">
            <BrandingTab />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsTab />
          </TabsContent>

          <TabsContent value="finance">
            <FinanceTab />
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsTab />
          </TabsContent>

          <TabsContent value="blog">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Blog Posts
                  </CardTitle>
                  <CardDescription>Create and manage blog posts</CardDescription>
                </div>
                <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openEditor()} data-testid="button-new-post">
                      <Plus className="h-4 w-4 mr-2" />
                      New Post
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
                      <DialogDescription>
                        {editingPost ? 'Update your blog post' : 'Write a new blog post for your site'}
                      </DialogDescription>
                    </DialogHeader>
                    <BlogPostEditor post={editingPost} onClose={closeEditor} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {postsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blogPostsData?.data?.length ? (
                        blogPostsData.data.map((post) => (
                          <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {post.featuredImageUrl && (
                                  <div className="w-12 h-12 rounded overflow-hidden shrink-0">
                                    <img src={post.featuredImageUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">{post.title}</div>
                                  <div className="text-sm text-muted-foreground">/{post.slug}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={post.status === 'published' ? 'default' : post.status === 'draft' ? 'secondary' : 'outline'}>
                                {post.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(post.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditor(post)}
                                  data-testid={`button-edit-post-${post.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this post?')) {
                                      deletePostMutation.mutate(post.id);
                                    }
                                  }}
                                  data-testid={`button-delete-post-${post.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No blog posts yet. Create your first post to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pages">
            <PagesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
