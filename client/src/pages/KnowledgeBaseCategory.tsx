import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { 
  ArrowLeft, 
  Clock, 
  ChevronRight,
  BookOpen,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { KbArticle, KbCategory } from "@shared/schema";

function ArticleCard({ article }: { article: KbArticle }) {
  return (
    <Link href={`/help/article/${article.slug}`} data-testid={`card-article-${article.id}`}>
      <Card className="hover-elevate cursor-pointer transition-all h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base line-clamp-2" data-testid={`text-article-title-${article.id}`}>{article.title}</CardTitle>
          {article.excerpt && (
            <CardDescription className="line-clamp-2">{article.excerpt}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            {article.readingTimeMinutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{article.readingTimeMinutes} min read</span>
              </div>
            )}
            {article.tags && article.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {article.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function KnowledgeBaseCategory() {
  const [, params] = useRoute("/help/category/:slug");
  const slug = params?.slug;

  const { data: categories, isLoading: categoriesLoading } = useQuery<KbCategory[]>({
    queryKey: ['/api/kb/categories'],
  });

  const category = useMemo(() => {
    if (!categories || !slug) return null;
    return categories.find(c => c.slug === slug);
  }, [categories, slug]);

  const { data: allArticles, isLoading: articlesLoading } = useQuery<KbArticle[]>({
    queryKey: ['/api/kb/articles', { categoryId: category?.id }],
    enabled: !!category?.id,
  });

  const articles = useMemo(() => {
    if (!allArticles || !category) return [];
    return allArticles.filter(a => a.categoryId === category.id);
  }, [allArticles, category]);

  if (categoriesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-1/2 mb-4" />
          <Skeleton className="h-6 w-1/3 mb-8" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center" data-testid="text-category-not-found">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-bold mb-2">Category Not Found</h1>
          <p className="text-muted-foreground mb-4">The category you're looking for doesn't exist.</p>
          <Link href="/help">
            <Button data-testid="button-back-to-help">Back to Help Center</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="nav-breadcrumb">
            <Link href="/help" className="hover:underline" data-testid="link-help-center">
              Help Center
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground" data-testid="text-current-category">{category.name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Link href="/help">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Help Center
          </Button>
        </Link>

        <div className="mb-8">
          <div 
            className="w-16 h-16 rounded-lg flex items-center justify-center mb-4"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <BookOpen className="w-8 h-8" style={{ color: category.color || '#6366f1' }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-category-name">{category.name}</h1>
          {category.description && (
            <p className="text-muted-foreground" data-testid="text-category-description">{category.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-article-count">
            {category.articleCount} article{category.articleCount !== 1 ? 's' : ''}
          </p>
        </div>

        {articlesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-articles">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No articles in this category yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
