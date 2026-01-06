import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { 
  ArrowLeft, 
  Clock, 
  ThumbsUp, 
  ThumbsDown, 
  ChevronRight,
  BookOpen,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { KbArticle, KbCategory } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function KnowledgeBaseArticle() {
  const [, params] = useRoute("/help/article/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  const { data: article, isLoading: articleLoading } = useQuery<KbArticle>({
    queryKey: ['/api/kb/articles', slug],
    enabled: !!slug,
  });

  const { data: categories } = useQuery<KbCategory[]>({
    queryKey: ['/api/kb/categories'],
  });

  const category = useMemo(() => {
    if (!article?.categoryId || !categories) return null;
    return categories.find((c) => c.id === article.categoryId);
  }, [article?.categoryId, categories]);

  const { data: categoryArticles } = useQuery<KbArticle[]>({
    queryKey: ['/api/kb/articles', { categoryId: article?.categoryId }],
    enabled: !!article?.categoryId,
  });

  const relatedArticles = useMemo(() => {
    if (!categoryArticles || !article) return [];
    return categoryArticles.filter((a) => a.id !== article.id).slice(0, 3);
  }, [categoryArticles, article]);

  const feedbackMutation = useMutation({
    mutationFn: async (helpful: boolean) => {
      return apiRequest('POST', `/api/kb/articles/${article?.id}/feedback`, { helpful });
    },
    onSuccess: (_, helpful) => {
      setFeedbackGiven(helpful);
      toast({
        title: "Thank you for your feedback!",
        description: helpful ? "We're glad this helped." : "We'll work to improve this article.",
      });
    },
    onError: () => {
      toast({
        title: "Feedback failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  if (articleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/4 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center" data-testid="text-article-not-found">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-4">The article you're looking for doesn't exist.</p>
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
            {category && (
              <>
                <Link href={`/help/category/${category.slug}`} className="hover:underline" data-testid="link-category">
                  {category.name}
                </Link>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
            <span className="text-foreground truncate" data-testid="text-current-article">{article.title}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          <article className="lg:col-span-3">
            <Link href="/help">
              <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Help Center
              </Button>
            </Link>

            <h1 className="text-3xl font-bold mb-4" data-testid="text-article-title">{article.title}</h1>
            
            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground mb-6">
              {article.readingTimeMinutes && (
                <div className="flex items-center gap-1" data-testid="text-reading-time">
                  <Clock className="w-4 h-4" />
                  <span>{article.readingTimeMinutes} min read</span>
                </div>
              )}
              {article.tags && article.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" data-testid={`badge-tag-${tag}`}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {article.featuredImageUrl && (
              <img 
                src={article.featuredImageUrl} 
                alt={article.title}
                className="w-full rounded-lg mb-8 max-h-80 object-cover"
                data-testid="img-featured"
              />
            )}

            <div 
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
              data-testid="text-article-content"
            />

            <Separator className="my-8" />

            <div className="bg-muted/50 rounded-lg p-6 text-center" data-testid="section-feedback">
              <h3 className="font-semibold mb-2">Was this article helpful?</h3>
              {feedbackGiven !== null ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground" data-testid="text-feedback-thanks">
                  <Check className="w-5 h-5 text-green-500" />
                  <span>Thanks for your feedback!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => feedbackMutation.mutate(true)}
                    disabled={feedbackMutation.isPending}
                    data-testid="button-helpful-yes"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => feedbackMutation.mutate(false)}
                    disabled={feedbackMutation.isPending}
                    data-testid="button-helpful-no"
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    No
                  </Button>
                </div>
              )}
            </div>
          </article>

          <aside className="lg:col-span-1">
            {relatedArticles.length > 0 && (
              <Card data-testid="card-related-articles">
                <CardHeader>
                  <CardTitle className="text-lg">Related Articles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {relatedArticles.map((relArticle) => (
                    <Link 
                      key={relArticle.id} 
                      href={`/help/article/${relArticle.slug}`}
                      data-testid={`link-related-article-${relArticle.id}`}
                    >
                      <div className="group cursor-pointer">
                        <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                          {relArticle.title}
                        </h4>
                        {relArticle.readingTimeMinutes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {relArticle.readingTimeMinutes} min read
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="mt-6" data-testid="card-need-help">
              <CardHeader>
                <CardTitle className="text-lg">Need More Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Can't find what you're looking for? Our support team is here to help.
                </p>
                <Link href="/pages/contact">
                  <Button variant="outline" className="w-full" data-testid="button-contact-support">
                    Contact Support
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
