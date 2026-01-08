import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Plus, 
  FileText, 
  FolderPlus, 
  Search, 
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  BookOpen,
  ExternalLink,
  Upload,
  Filter,
  Settings,
  Share2,
  Copy,
  Check,
  Code,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarProvider } from "@/components/Sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KbArticle, KbCategory, Guide } from "@shared/schema";

interface KbBrandingSettings {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  headerTitle: string;
  headerSubtitle: string;
  showSearch: boolean;
  showCategories: boolean;
}

const defaultBranding: KbBrandingSettings = {
  logoUrl: '',
  primaryColor: '#3b82f6',
  accentColor: '#8b5cf6',
  headerTitle: 'Help Center',
  headerSubtitle: 'Find answers to your questions',
  showSearch: true,
  showCategories: true,
};

export default function KnowledgeBaseManager() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createArticleOpen, setCreateArticleOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [importGuideOpen, setImportGuideOpen] = useState(false);
  const [deleteArticleId, setDeleteArticleId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: branding = defaultBranding } = useQuery<KbBrandingSettings>({
    queryKey: ['/api/kb/branding'],
  });

  const saveBrandingMutation = useMutation({
    mutationFn: async (newBranding: KbBrandingSettings) => {
      return await apiRequest('PUT', '/api/kb/branding', newBranding);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/branding'] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery<KbArticle[]>({
    queryKey: ['/api/kb/articles/manage'],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<KbCategory[]>({
    queryKey: ['/api/kb/categories'],
  });

  const { data: guidesResponse } = useQuery<{ guides: Guide[]; total: number; page: number; hasMore: boolean }>({
    queryKey: ['/api/guides'],
  });
  const guides = guidesResponse?.guides || [];

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (article.excerpt?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === "all" || article.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || 
        (categoryFilter === "uncategorized" && !article.categoryId) ||
        article.categoryId?.toString() === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [articles, searchTerm, statusFilter, categoryFilter]);

  const deleteArticleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/kb/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/articles/manage'] });
      toast({ title: "Article deleted" });
      setDeleteArticleId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete article", variant: "destructive" });
    }
  });

  const publishArticleMutation = useMutation({
    mutationFn: async ({ id, publish }: { id: number; publish: boolean }) => {
      await apiRequest('PATCH', `/api/kb/articles/${id}`, { status: publish ? 'published' : 'draft' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/articles/manage'] });
      toast({ title: "Article updated" });
    },
    onError: () => {
      toast({ title: "Failed to update article", variant: "destructive" });
    }
  });

  const stats = useMemo(() => {
    const published = articles.filter(a => a.status === 'published').length;
    const draft = articles.filter(a => a.status === 'draft').length;
    const archived = articles.filter(a => a.status === 'archived').length;
    return { total: articles.length, published, draft, archived, categories: categories.length };
  }, [articles, categories]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
              <div>
                <h1 className="text-3xl font-bold" data-testid="text-page-title">Knowledge Base</h1>
                <p className="text-muted-foreground mt-1">Create and manage your help center articles</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => window.open('/help', '_blank')}
                  data-testid="button-preview-kb"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShareOpen(true)}
                  data-testid="button-share-kb"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSettingsOpen(true)}
                  data-testid="button-kb-settings"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCreateCategoryOpen(true)}
                  data-testid="button-create-category"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Category
                </Button>
                <Button
                  onClick={() => setCreateArticleOpen(true)}
                  data-testid="button-create-article"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Article
                </Button>
                <Button
                  onClick={() => setImportGuideOpen(true)}
                  className="bg-gradient-to-r from-primary to-purple-600 text-white border-0"
                  data-testid="button-import-guide"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import from Flows
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5 mb-8">
              <Card data-testid="stat-total-articles">
                <CardHeader className="pb-2">
                  <CardDescription>Total Articles</CardDescription>
                  <CardTitle className="text-2xl">{stats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card data-testid="stat-published">
                <CardHeader className="pb-2">
                  <CardDescription>Published</CardDescription>
                  <CardTitle className="text-2xl text-green-600">{stats.published}</CardTitle>
                </CardHeader>
              </Card>
              <Card data-testid="stat-draft">
                <CardHeader className="pb-2">
                  <CardDescription>Drafts</CardDescription>
                  <CardTitle className="text-2xl text-yellow-600">{stats.draft}</CardTitle>
                </CardHeader>
              </Card>
              <Card data-testid="stat-archived">
                <CardHeader className="pb-2">
                  <CardDescription>Archived</CardDescription>
                  <CardTitle className="text-2xl text-muted-foreground">{stats.archived}</CardTitle>
                </CardHeader>
              </Card>
              <Card data-testid="stat-categories">
                <CardHeader className="pb-2">
                  <CardDescription>Categories</CardDescription>
                  <CardTitle className="text-2xl">{stats.categories}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Tabs defaultValue="articles" className="space-y-6">
              <TabsList data-testid="tabs-kb-manager">
                <TabsTrigger value="articles" data-testid="tab-articles">Articles</TabsTrigger>
                <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
              </TabsList>

              <TabsContent value="articles" className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search articles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-articles"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {articlesLoading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading articles...</div>
                ) : filteredArticles.length === 0 ? (
                  <Card className="text-center py-12" data-testid="empty-articles">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No articles found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || statusFilter !== "all" || categoryFilter !== "all"
                        ? "Try adjusting your filters"
                        : "Create your first article to get started"}
                    </p>
                    <Button onClick={() => setCreateArticleOpen(true)} data-testid="button-create-first-article">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Article
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredArticles.map((article) => {
                      const category = categories.find(c => c.id === article.categoryId);
                      return (
                        <Card key={article.id} className="hover-elevate" data-testid={`card-article-${article.id}`}>
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-medium truncate">{article.title}</h3>
                                  <Badge 
                                    variant={article.status === 'published' ? 'default' : 'secondary'}
                                    className={article.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : ''}
                                  >
                                    {article.status}
                                  </Badge>
                                  {category && (
                                    <Badge variant="outline">{category.name}</Badge>
                                  )}
                                </div>
                                {article.excerpt && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{article.excerpt}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Link href={`/help/article/${article.slug}`}>
                                  <Button variant="ghost" size="icon" data-testid={`button-view-${article.id}`}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-more-${article.id}`}>
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <Link href={`/knowledge-base/${article.id}/edit`}>
                                      <DropdownMenuItem data-testid={`menu-edit-${article.id}`}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                    </Link>
                                    <DropdownMenuItem onClick={() => window.open(`/help/article/${article.slug}`, '_blank')} data-testid={`menu-preview-${article.id}`}>
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      Preview
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {article.status !== 'published' && (
                                      <DropdownMenuItem 
                                        onClick={() => publishArticleMutation.mutate({ id: article.id, publish: true })}
                                        data-testid={`menu-publish-${article.id}`}
                                      >
                                        <Eye className="w-4 h-4 mr-2" />
                                        Publish
                                      </DropdownMenuItem>
                                    )}
                                    {article.status === 'published' && (
                                      <DropdownMenuItem 
                                        onClick={() => publishArticleMutation.mutate({ id: article.id, publish: false })}
                                        data-testid={`menu-unpublish-${article.id}`}
                                      >
                                        <Eye className="w-4 h-4 mr-2" />
                                        Unpublish
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => setDeleteArticleId(article.id)}
                                      data-testid={`menu-delete-${article.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="categories" className="space-y-4">
                <CategoriesTab 
                  categories={categories} 
                  articles={articles}
                  isLoading={categoriesLoading}
                  onCreateCategory={() => setCreateCategoryOpen(true)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <CreateArticleDialog 
        open={createArticleOpen} 
        onOpenChange={setCreateArticleOpen}
        categories={categories}
      />

      <CreateCategoryDialog 
        open={createCategoryOpen} 
        onOpenChange={setCreateCategoryOpen}
      />

      <ImportGuideDialog
        open={importGuideOpen}
        onOpenChange={setImportGuideOpen}
        guides={guides}
        categories={categories}
      />

      <Dialog open={deleteArticleId !== null} onOpenChange={(open) => !open && setDeleteArticleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this article? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteArticleId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteArticleId && deleteArticleMutation.mutate(deleteArticleId)}
              disabled={deleteArticleMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KbSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        branding={branding}
        onSave={(newBranding) => {
          saveBrandingMutation.mutate(newBranding);
        }}
        isSaving={saveBrandingMutation.isPending}
      />

      <KbShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </SidebarProvider>
  );
}

function CategoriesTab({ 
  categories, 
  articles,
  isLoading, 
  onCreateCategory 
}: { 
  categories: KbCategory[]; 
  articles: KbArticle[];
  isLoading: boolean;
  onCreateCategory: () => void;
}) {
  const { toast } = useToast();
  const [deleteCategoryId, setDeleteCategoryId] = useState<number | null>(null);

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/kb/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/categories'] });
      toast({ title: "Category deleted" });
      setDeleteCategoryId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete category", variant: "destructive" });
    }
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading categories...</div>;
  }

  if (categories.length === 0) {
    return (
      <Card className="text-center py-12" data-testid="empty-categories">
        <FolderPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No categories yet</h3>
        <p className="text-muted-foreground mb-4">Create categories to organize your articles</p>
        <Button onClick={onCreateCategory} data-testid="button-create-first-category">
          <FolderPlus className="w-4 h-4 mr-2" />
          Create Category
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const articleCount = articles.filter(a => a.categoryId === category.id).length;
          return (
            <Card key={category.id} className="hover-elevate" data-testid={`card-category-${category.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    {category.description && (
                      <CardDescription className="mt-1 line-clamp-2">{category.description}</CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-category-more-${category.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/help/category/${category.slug}`}>
                        <DropdownMenuItem data-testid={`menu-view-category-${category.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteCategoryId(category.id)}
                        data-testid={`menu-delete-category-${category.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>{articleCount} article{articleCount !== 1 ? 's' : ''}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={deleteCategoryId !== null} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this category? Articles in this category will become uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryId(null)} data-testid="button-cancel-delete-category">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteCategoryId && deleteCategoryMutation.mutate(deleteCategoryId)}
              disabled={deleteCategoryMutation.isPending}
              data-testid="button-confirm-delete-category"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateArticleDialog({ 
  open, 
  onOpenChange, 
  categories 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  categories: KbCategory[];
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; excerpt: string | null; categoryId: number | null }) => {
      const response = await apiRequest('POST', '/api/kb/articles', {
        ...data,
        content: '',
        status: 'draft',
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/articles/manage'] });
      toast({ title: "Article created" });
      onOpenChange(false);
      setTitle("");
      setExcerpt("");
      setCategoryId("");
      // Redirect to edit page
      window.location.href = `/knowledge-base/${data.id}/edit`;
    },
    onError: () => {
      toast({ title: "Failed to create article", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      categoryId: categoryId ? parseInt(categoryId) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Article</DialogTitle>
          <DialogDescription>
            Add a new article to your knowledge base.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article title"
              data-testid="input-article-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (optional)</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief description of the article"
              rows={2}
              data-testid="input-article-excerpt"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="select-article-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create-article">
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createMutation.isPending} data-testid="button-submit-create-article">
              Create Article
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateCategoryDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest('POST', '/api/kb/categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/categories'] });
      toast({ title: "Category created" });
      onOpenChange(false);
      setName("");
      setDescription("");
    },
    onError: () => {
      toast({ title: "Failed to create category", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new category to organize your articles.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
              data-testid="input-category-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the category"
              rows={2}
              data-testid="input-category-description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create-category">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending} data-testid="button-submit-create-category">
              Create Category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportGuideDialog({
  open,
  onOpenChange,
  guides,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guides: Guide[];
  categories: KbCategory[];
}) {
  const { toast } = useToast();
  const [selectedGuideId, setSelectedGuideId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");

  const selectedGuide = guides.find(g => g.id.toString() === selectedGuideId);

  const importMutation = useMutation({
    mutationFn: async (data: { guideId: number; title: string; excerpt: string; categoryId: number | null }) => {
      return await apiRequest('POST', `/api/guides/${data.guideId}/convert-to-kb`, {
        title: data.title,
        excerpt: data.excerpt,
        categoryId: data.categoryId,
        tags: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kb/articles/manage'] });
      toast({ title: "Flow imported successfully" });
      onOpenChange(false);
      setSelectedGuideId("");
      setCategoryId("");
      setTitle("");
      setExcerpt("");
    },
    onError: () => {
      toast({ title: "Failed to import flow", variant: "destructive" });
    }
  });

  const handleGuideSelect = (guideId: string) => {
    setSelectedGuideId(guideId);
    const guide = guides.find(g => g.id.toString() === guideId);
    if (guide) {
      setTitle(guide.title);
      setExcerpt(guide.description || "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuideId || !title.trim()) return;
    importMutation.mutate({
      guideId: parseInt(selectedGuideId),
      title: title.trim(),
      excerpt: excerpt.trim(),
      categoryId: categoryId ? parseInt(categoryId) : null,
    });
  };

  const publishedGuides = guides.filter(g => g.status === 'published');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Import Guide to Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Convert a published guide into a knowledge base article.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guide">Select Flow</Label>
            <Select value={selectedGuideId} onValueChange={handleGuideSelect}>
              <SelectTrigger data-testid="select-import-guide">
                <SelectValue placeholder="Select a flow to import" />
              </SelectTrigger>
              <SelectContent>
                {publishedGuides.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No published flows available</div>
                ) : (
                  publishedGuides.map((guide) => (
                    <SelectItem key={guide.id} value={guide.id.toString()}>
                      {guide.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedGuide && (
            <>
              <div className="space-y-2">
                <Label htmlFor="import-title">Article Title</Label>
                <Input
                  id="import-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter article title"
                  data-testid="input-import-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-excerpt">Excerpt (optional)</Label>
                <Textarea
                  id="import-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Brief description of the article"
                  rows={2}
                  data-testid="input-import-excerpt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-category">Category (optional)</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger data-testid="select-import-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-import">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedGuideId || !title.trim() || importMutation.isPending}
              data-testid="button-submit-import"
            >
              Import Guide
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KbSettingsDialog({
  open,
  onOpenChange,
  branding,
  onSave,
  isSaving = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branding: KbBrandingSettings;
  onSave: (branding: KbBrandingSettings) => void;
  isSaving?: boolean;
}) {
  const [localBranding, setLocalBranding] = useState<KbBrandingSettings>(branding);

  useEffect(() => {
    if (open) {
      setLocalBranding(branding);
    }
  }, [open, branding]);

  const handleSave = () => {
    onSave(localBranding);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Knowledge Base Settings
          </DialogTitle>
          <DialogDescription>
            Customize the appearance of your public Knowledge Base.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kb-title">Header Title</Label>
            <Input
              id="kb-title"
              value={localBranding.headerTitle}
              onChange={(e) => setLocalBranding({ ...localBranding, headerTitle: e.target.value })}
              placeholder="Help Center"
              data-testid="input-kb-header-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-subtitle">Header Subtitle</Label>
            <Input
              id="kb-subtitle"
              value={localBranding.headerSubtitle}
              onChange={(e) => setLocalBranding({ ...localBranding, headerSubtitle: e.target.value })}
              placeholder="Find answers to your questions"
              data-testid="input-kb-header-subtitle"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-logo">Logo URL (optional)</Label>
            <Input
              id="kb-logo"
              value={localBranding.logoUrl}
              onChange={(e) => setLocalBranding({ ...localBranding, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              data-testid="input-kb-logo-url"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kb-primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="kb-primary-color"
                  type="color"
                  value={localBranding.primaryColor}
                  onChange={(e) => setLocalBranding({ ...localBranding, primaryColor: e.target.value })}
                  className="w-12 h-9 p-1"
                  data-testid="input-kb-primary-color"
                />
                <Input
                  value={localBranding.primaryColor}
                  onChange={(e) => setLocalBranding({ ...localBranding, primaryColor: e.target.value })}
                  className="flex-1"
                  data-testid="input-kb-primary-color-text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-accent-color">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="kb-accent-color"
                  type="color"
                  value={localBranding.accentColor}
                  onChange={(e) => setLocalBranding({ ...localBranding, accentColor: e.target.value })}
                  className="w-12 h-9 p-1"
                  data-testid="input-kb-accent-color"
                />
                <Input
                  value={localBranding.accentColor}
                  onChange={(e) => setLocalBranding({ ...localBranding, accentColor: e.target.value })}
                  className="flex-1"
                  data-testid="input-kb-accent-color-text"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="kb-show-search">Show Search Bar</Label>
            <input
              id="kb-show-search"
              type="checkbox"
              checked={localBranding.showSearch}
              onChange={(e) => setLocalBranding({ ...localBranding, showSearch: e.target.checked })}
              className="w-4 h-4"
              data-testid="checkbox-kb-show-search"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="kb-show-categories">Show Categories</Label>
            <input
              id="kb-show-categories"
              type="checkbox"
              checked={localBranding.showCategories}
              onChange={(e) => setLocalBranding({ ...localBranding, showCategories: e.target.checked })}
              className="w-4 h-4"
              data-testid="checkbox-kb-show-categories"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-kb-settings">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-kb-settings">
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KbShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const kbUrl = `${window.location.origin}/help`;
  const embedCode = `<iframe src="${kbUrl}" width="100%" height="600" style="border: 1px solid #e5e7eb; border-radius: 8px;" title="Knowledge Base"></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Share your Knowledge Base with a direct link or embed it on your website.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Direct Link
            </Label>
            <div className="flex gap-2">
              <Input
                value={kbUrl}
                readOnly
                className="flex-1"
                data-testid="input-kb-share-link"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(kbUrl, 'link')}
                data-testid="button-copy-kb-link"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(kbUrl, '_blank')}
                data-testid="button-open-kb-link"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Embed Code
            </Label>
            <Textarea
              value={embedCode}
              readOnly
              rows={4}
              className="font-mono text-sm"
              data-testid="textarea-kb-embed-code"
            />
            <Button
              variant="outline"
              onClick={() => copyToClipboard(embedCode, 'embed')}
              className="w-full"
              data-testid="button-copy-kb-embed"
            >
              {copiedEmbed ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Embed Code
                </>
              )}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-share-dialog">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
