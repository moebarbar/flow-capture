import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { blogArticles, getAllCategories } from "@/data/blogArticles";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = getAllCategories();
  
  const { data: branding } = useQuery<SiteSettings>({
    queryKey: ['/api/settings/public'],
  });

  const siteName = branding?.siteName || "FlowCapture";

  const filteredArticles = selectedCategory 
    ? blogArticles.filter(a => a.category === selectedCategory)
    : blogArticles;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 glass border-b border-white/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-blog-home">
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
              <Link href="/" data-testid="link-back-home">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-16 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1.5" data-testid="badge-blog">
              Blog & Resources
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6">
              Insights for Documentation Excellence
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Expert tips, best practices, and strategies for creating documentation that teams actually use.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
              data-testid="button-filter-all"
            >
              All Articles
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="rounded-full"
                data-testid={`button-filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredArticles.map((article, index) => (
              <motion.div
                key={article.id}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/blog/${article.slug}`} data-testid={`card-article-${article.slug}`}>
                  <Card className="h-full overflow-hidden group hover-elevate cursor-pointer">
                    <div className="aspect-video overflow-hidden bg-muted">
                      <img
                        src={imageMap[article.id]}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {article.category}
                        </Badge>
                        {article.featured && (
                          <Badge className="text-xs bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-xl font-display font-bold mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
                        {article.title}
                      </h2>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(article.publishedAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {article.readTime}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-display font-bold mb-4">
            Ready to Transform Your Documentation?
          </h2>
          <p className="text-muted-foreground mb-8">
            Start capturing workflows and creating beautiful documentation in minutes.
          </p>
          <Button size="lg" className="rounded-full px-8" asChild>
            <Link href="/" data-testid="button-blog-cta">
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
