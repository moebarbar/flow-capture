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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, CreditCard, FileText, TrendingUp, Shield, Plus, Pencil, Trash2, Image, BookOpen } from "lucide-react";
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
        {featuredImageUrl && (
          <Input
            value={featuredImageUrl}
            onChange={(e) => setFeaturedImageUrl(e.target.value)}
            placeholder="Or paste image URL"
            className="mt-2"
            data-testid="input-post-image-url"
          />
        )}
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

  const { data: subscriptionsData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/admin/subscriptions'],
  });

  const { data: invoicesData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/admin/invoices'],
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
            <p className="text-muted-foreground">Manage users, subscriptions, blog posts, and billing</p>
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
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="blog" data-testid="tab-blog">Blog Posts</TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage all registered users</CardDescription>
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

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
                <CardDescription>View all subscription records from Stripe</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subscription ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptionsData?.data?.length ? (
                      subscriptionsData.data.map((sub: any) => (
                        <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                          <TableCell className="font-mono text-sm">{sub.id}</TableCell>
                          <TableCell>{sub.customer}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status === 'active' ? 'default' : 'outline'}>
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.created ? format(new Date(sub.created * 1000), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No subscriptions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>View all invoices from Stripe</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesData?.data?.length ? (
                      invoicesData.data.map((inv: any) => (
                        <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                          <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                          <TableCell>
                            ${((inv.amount_due || 0) / 100).toFixed(2)} {inv.currency?.toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={inv.status === 'paid' ? 'default' : 'outline'}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inv.created ? format(new Date(inv.created * 1000), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
