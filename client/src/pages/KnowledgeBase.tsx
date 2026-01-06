import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Search, 
  BookOpen, 
  FileText, 
  Clock, 
  ChevronRight,
  ArrowLeft,
  ThumbsUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { KbCategory, KbArticle } from "@shared/schema";

function getCategoryIcon(iconName: string | null) {
  switch (iconName) {
    case "FileText": return FileText;
    case "Clock": return Clock;
    case "ThumbsUp": return ThumbsUp;
    default: return BookOpen;
  }
}

function CategoryCard({ category }: { category: KbCategory }) {
  const Icon = getCategoryIcon(category.icon);
  
  return (
    <Link href={`/help/category/${category.slug}`} data-testid={`card-category-${category.id}`}>
      <Card className="hover-elevate cursor-pointer h-full transition-all">
        <CardHeader className="pb-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color: category.color || '#6366f1' }} />
          </div>
          <CardTitle className="text-lg" data-testid={`text-category-name-${category.id}`}>{category.name}</CardTitle>
          {category.description && (
            <CardDescription className="line-clamp-2">{category.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span data-testid={`text-article-count-${category.id}`}>{category.articleCount} article{category.articleCount !== 1 ? 's' : ''}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

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
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SearchResults({ query }: { query: string }) {
  const { data: articles, isLoading } = useQuery<KbArticle[]>({
    queryKey: ['/api/kb/search', { q: query }],
    enabled: query.length >= 2,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-results">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No articles found for "{query}"</p>
        <p className="text-sm mt-2">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" data-testid="text-search-results-count">
        Found {articles.length} article{articles.length !== 1 ? 's' : ''} for "{query}"
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}

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

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: branding = defaultBranding } = useQuery<KbBrandingSettings>({
    queryKey: ['/api/kb/branding'],
  });

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchQuery]);

  const { data: categories, isLoading: categoriesLoading } = useQuery<KbCategory[]>({
    queryKey: ['/api/kb/categories'],
  });

  const { data: articles, isLoading: articlesLoading } = useQuery<KbArticle[]>({
    queryKey: ['/api/kb/articles'],
  });

  const isSearching = debouncedQuery.length >= 2;

  return (
    <div className="min-h-screen bg-background">
      <div 
        className="border-b"
        style={{ 
          background: `linear-gradient(to bottom, ${branding.primaryColor}10, transparent)` 
        }}
      >
        <div className="container mx-auto px-4 py-12">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="max-w-2xl mx-auto text-center">
            {branding.logoUrl && (
              <img 
                src={branding.logoUrl} 
                alt="Logo" 
                className="h-12 mx-auto mb-4 object-contain"
                data-testid="img-kb-logo"
              />
            )}
            <h1 className="text-4xl font-bold mb-4" data-testid="text-page-title">{branding.headerTitle}</h1>
            <p className="text-muted-foreground mb-8">
              {branding.headerSubtitle}
            </p>
            
            {branding.showSearch && (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for articles..."
                  className="pl-12 h-12 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-kb"
                  style={{ 
                    borderColor: `${branding.primaryColor}40`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {isSearching ? (
          <SearchResults query={debouncedQuery} />
        ) : (
          <>
            {branding.showCategories && (
              <section className="mb-12">
                <h2 className="text-2xl font-semibold mb-6" data-testid="text-categories-heading">Browse by Category</h2>
                {categoriesLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-48" />
                    ))}
                  </div>
                ) : categories && categories.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {categories.map((category) => (
                      <CategoryCard key={category.id} category={category} />
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-categories">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No categories available yet</p>
                  </Card>
                )}
              </section>
            )}

            <section>
              <h2 className="text-2xl font-semibold mb-6" data-testid="text-articles-heading">Recent Articles</h2>
              {articlesLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : articles && articles.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {articles.slice(0, 9).map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-articles">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No articles available yet</p>
                </Card>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
