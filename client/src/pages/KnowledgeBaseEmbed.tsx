import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Clock, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { KbArticle } from "@shared/schema";

export default function KnowledgeBaseEmbed() {
  const [, params] = useRoute("/help/embed/:slug");
  const slug = params?.slug;

  const { data: article, isLoading } = useQuery<KbArticle>({
    queryKey: ['/api/kb/articles', slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center" data-testid="text-embed-not-found">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground">This article is not available for embedding.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold mb-3" data-testid="text-embed-title">{article.title}</h1>
          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            {article.readingTimeMinutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{article.readingTimeMinutes} min read</span>
              </div>
            )}
            {article.tags && article.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </header>

        {article.featuredImageUrl && (
          <img
            src={article.featuredImageUrl}
            alt={article.title}
            className="w-full rounded-lg mb-6 max-h-60 object-cover"
          />
        )}

        <article
          className="prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content }}
          data-testid="text-embed-content"
        />

        <footer className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
          <a
            href={`/help/article/${article.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
            data-testid="link-view-full"
          >
            View full article on FlowCapture
          </a>
        </footer>
      </div>
    </div>
  );
}
