import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Calendar, Clock, User, Share2, Twitter, Linkedin, Link2 } from "lucide-react";
import { getArticleBySlug, blogArticles } from "@/data/blogArticles";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

import sopImage from "@assets/generated_images/sop_documentation_workflow_abstract.png";
import onboardingImage from "@assets/generated_images/employee_onboarding_journey_path.png";
import aiImage from "@assets/generated_images/ai_knowledge_brain_network.png";
import supportImage from "@assets/generated_images/customer_support_knowledge_transformation.png";
import saasImage from "@assets/generated_images/saas_product_adoption_growth.png";
import remoteImage from "@assets/generated_images/remote_team_global_knowledge.png";

const imageMap: Record<string, string> = {
  "1": sopImage,
  "2": onboardingImage,
  "3": aiImage,
  "4": supportImage,
  "5": saasImage,
  "6": remoteImage,
};

interface SiteSettings {
  siteName?: string;
  logoUrl?: string | null;
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.trim().split('\n');
  const elements: JSX.Element[] = [];
  let key = 0;
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-6 space-y-2 mb-6">
          {listItems.map((item, i) => (
            <li key={i} className="text-muted-foreground">{formatInlineText(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const formatInlineText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '') {
      flushList();
      return;
    }

    if (trimmedLine.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={key++} className="text-3xl md:text-4xl font-display font-bold mb-6 mt-8 first:mt-0">
          {trimmedLine.slice(2)}
        </h1>
      );
    } else if (trimmedLine.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-2xl font-display font-bold mb-4 mt-8">
          {trimmedLine.slice(3)}
        </h2>
      );
    } else if (trimmedLine.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-xl font-display font-semibold mb-3 mt-6">
          {trimmedLine.slice(4)}
        </h3>
      );
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      inList = true;
      listItems.push(trimmedLine.slice(2));
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      flushList();
      const match = trimmedLine.match(/^\d+\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={key++} className="flex gap-3 mb-3">
            <span className="font-bold text-brand-600">{trimmedLine.match(/^\d+/)?.[0]}.</span>
            <span className="text-muted-foreground">{formatInlineText(match[1])}</span>
          </div>
        );
      }
    } else {
      flushList();
      elements.push(
        <p key={key++} className="text-muted-foreground mb-4 leading-relaxed">
          {formatInlineText(trimmedLine)}
        </p>
      );
    }
  });

  flushList();

  return <div className="prose-content">{elements}</div>;
}

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = getArticleBySlug(slug || '');
  const { toast } = useToast();
  
  const { data: branding } = useQuery<SiteSettings>({
    queryKey: ['/api/settings/public'],
  });

  const siteName = branding?.siteName || "FlowCapture";

  useEffect(() => {
    if (article) {
      document.title = `${article.title} | ${siteName} Blog`;
    }
  }, [article, siteName]);

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
          <Button asChild>
            <Link href="/blog">Back to Blog</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentIndex = blogArticles.findIndex(a => a.id === article.id);
  const nextArticle = blogArticles[currentIndex + 1] || blogArticles[0];
  const prevArticle = blogArticles[currentIndex - 1] || blogArticles[blogArticles.length - 1];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Article link has been copied to clipboard.",
    });
  };

  const handleShare = (platform: 'twitter' | 'linkedin') => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(article.title);
    
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
    } else {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 glass border-b border-white/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-article-home">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={siteName} className="h-8 w-8 object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
                {siteName.charAt(0)}
              </div>
            )}
            <span className="font-display font-bold text-xl tracking-tight">{siteName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/blog" data-testid="link-back-blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                All Articles
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <article className="pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">{article.category}</Badge>
                {article.featured && (
                  <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    Featured
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 leading-tight">
                {article.title}
              </h1>
              <p className="text-xl text-muted-foreground mb-6">
                {article.excerpt}
              </p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-8">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    <User className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{article.author.name}</div>
                    <div className="text-xs">{article.author.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(article.publishedAt).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {article.readTime}
                  </span>
                </div>
              </div>
            </div>

            <div className="aspect-video rounded-xl overflow-hidden mb-12 bg-muted">
              <img
                src={imageMap[article.id]}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="prose-lg max-w-none">
              <MarkdownRenderer content={article.content} />
            </div>

            <div className="mt-12 pt-8 border-t border-border">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {article.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground mr-2">Share:</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleShare('twitter')}
                    data-testid="button-share-twitter"
                  >
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleShare('linkedin')}
                    data-testid="button-share-linkedin"
                  >
                    <Linkedin className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={handleCopyLink}
                    data-testid="button-copy-link"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </article>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-bold mb-8 text-center">Continue Reading</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href={`/blog/${prevArticle.slug}`} data-testid="card-prev-article">
              <Card className="p-6 h-full hover-elevate cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <ArrowLeft className="h-4 w-4" />
                  Previous Article
                </div>
                <h3 className="font-display font-semibold line-clamp-2">{prevArticle.title}</h3>
              </Card>
            </Link>
            <Link href={`/blog/${nextArticle.slug}`} data-testid="card-next-article">
              <Card className="p-6 h-full hover-elevate cursor-pointer">
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground mb-2">
                  Next Article
                  <ArrowRight className="h-4 w-4" />
                </div>
                <h3 className="font-display font-semibold text-right line-clamp-2">{nextArticle.title}</h3>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-display font-bold mb-4">
            Ready to Transform Your Documentation?
          </h2>
          <p className="text-muted-foreground mb-8">
            Start capturing workflows and creating beautiful documentation in minutes.
          </p>
          <Button size="lg" className="rounded-full px-8" asChild>
            <Link href="/" data-testid="button-article-cta">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
