import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  Check, ArrowRight, Zap, Share2, Layers, Clock, DollarSign, 
  Users, GraduationCap, Headphones, TrendingUp, MousePointer, 
  Camera, FileText, Send, Quote, Building2, Briefcase, Download,
  Sparkles, Globe, Languages, MessageSquare, PlayCircle, Shield,
  Eye, EyeOff, LayoutTemplate, History, BarChart3, AlertTriangle,
  MessageCircle, BookOpen, Key, ClipboardList, Globe2, Code,
  Lock, CheckCircle2, Star, Wand2, Video, Box, ShieldCheck
} from "lucide-react";
import { SiGooglechrome, SiSlack } from "react-icons/si";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SiteSettings {
  siteName?: string;
  siteDescription?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  extensionLink?: string | null;
  demoLink?: string | null;
  pricingLink?: string | null;
  docsLink?: string | null;
}

interface FooterPage {
  id: number;
  title: string;
  slug: string;
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  const { user } = useAuth();

  const { data: branding } = useQuery<SiteSettings>({
    queryKey: ['/api/settings/public'],
  });

  const { data: footerPagesData } = useQuery<{ data: FooterPage[] }>({
    queryKey: ['/api/pages/footer'],
  });

  const siteName = branding?.siteName || "FlowCapture";
  const footerPages = footerPagesData?.data || [];

  useEffect(() => {
    if (user) {
      window.location.href = "/";
    }
  }, [user]);

  useEffect(() => {
    const existingLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    
    if (branding?.faviconUrl) {
      if (existingLink) {
        existingLink.href = branding.faviconUrl;
      } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = branding.faviconUrl;
        document.head.appendChild(link);
      }
    }
  }, [branding]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand-200 selection:text-brand-900">
      {/* Navbar */}
      <nav className="fixed w-full z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={siteName} className="h-8 w-8 object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
                {siteName.charAt(0)}
              </div>
            )}
            <span className="font-display font-bold text-xl tracking-tight">{siteName}</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-features">Features</a>
            <a href="#ai-powered" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-ai">AI Features</a>
            <a href="#enterprise" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-enterprise">Enterprise</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-pricing">Pricing</a>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <a href="/api/login" data-testid="link-nav-login">Log in</a>
            </Button>
            <Button asChild className="rounded-full px-6 bg-brand-600 text-white shadow-lg shadow-brand-500/25">
              <a href="/api/login" data-testid="link-nav-get-started">Get Started <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[800px] bg-gradient-to-b from-brand-100/60 via-brand-50/30 to-transparent dark:from-brand-950/40 dark:via-brand-900/20 -z-10 blur-3xl rounded-full opacity-70" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-400/20 dark:from-purple-900/20 dark:to-pink-900/20 -z-10 blur-3xl rounded-full" />
        <div className="absolute top-40 left-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 dark:from-blue-900/20 dark:to-cyan-900/20 -z-10 blur-3xl rounded-full" />
        
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-sm font-medium bg-brand-100 text-brand-700 border border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800" data-testid="text-trust-badge">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Now with AI-Powered Features
              </Badge>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight mb-8 pb-2 leading-[1.1] bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-brand-800 to-brand-600 dark:from-white dark:via-brand-200 dark:to-brand-400">
              Documentation that <br className="hidden sm:block" />
              <span className="relative">
                writes itself
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 4 100 2 150 6C200 10 250 8 298 4" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--brand-500))" />
                      <stop offset="100%" stopColor="hsl(var(--brand-700))" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Capture any workflow, get AI-generated guides with screenshots, translations, and analytics.
              The complete documentation platform for modern teams.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Button size="lg" className="rounded-full text-lg h-14 px-10 bg-brand-600 text-white shadow-xl shadow-brand-500/30 transition-all" asChild>
                <a href={branding?.extensionLink || "#install-extension"} target={branding?.extensionLink?.startsWith('http') ? "_blank" : undefined} rel={branding?.extensionLink?.startsWith('http') ? "noopener noreferrer" : undefined} data-testid="button-hero-install-extension">
                  <SiGooglechrome className="mr-2 h-5 w-5" />
                  Start Free Today
                </a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full text-lg h-14 px-8 border-2" asChild>
                <a href={branding?.demoLink || "#how-it-works"} target={branding?.demoLink?.startsWith('http') ? "_blank" : undefined} rel={branding?.demoLink?.startsWith('http') ? "noopener noreferrer" : undefined} data-testid="link-how-it-works">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Watch Demo
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2" data-testid="text-hero-free"><Check className="h-4 w-4 text-brand-600" /> Free forever for individuals</span>
              <span className="flex items-center gap-2" data-testid="text-hero-no-cc"><Check className="h-4 w-4 text-brand-600" /> No credit card required</span>
              <span className="flex items-center gap-2" data-testid="text-hero-enterprise"><Check className="h-4 w-4 text-brand-600" /> Enterprise ready</span>
            </div>
          </motion.div>

          {/* Product Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 relative mx-auto max-w-6xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-brand-500/20 via-purple-500/20 to-pink-500/20 blur-3xl -z-10 scale-110" />
            <div className="rounded-2xl border border-border/50 shadow-2xl overflow-hidden bg-card/80 backdrop-blur-sm">
              <div className="h-10 bg-muted/50 border-b border-border flex items-center px-4 gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <div className="h-3 w-3 rounded-full bg-green-400/80" />
                <div className="flex-1 text-center text-xs text-muted-foreground">FlowCapture Editor</div>
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-4 flex gap-4">
                  {/* Left Panel - Steps */}
                  <div className="w-1/4 bg-card rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                      <div className="h-2 w-20 bg-muted rounded" />
                    </div>
                    {[1, 2, 3, 4].map((step) => (
                      <div key={step} className={`p-3 rounded-lg border ${step === 2 ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-border'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-5 w-5 rounded bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600">{step}</div>
                          <div className="h-2 flex-1 bg-muted rounded" />
                        </div>
                        <div className="h-12 bg-muted/50 rounded" />
                      </div>
                    ))}
                  </div>
                  {/* Center Panel - Screenshot */}
                  <div className="flex-1 bg-card rounded-xl border border-border p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <div className="h-2 w-24 bg-muted rounded" />
                      </div>
                      <div className="flex gap-2">
                        <div className="h-6 w-6 rounded bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                          <Wand2 className="h-3 w-3 text-brand-600" />
                        </div>
                        <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                          <Languages className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-border flex items-center justify-center relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-8 rounded border-2 border-brand-500 border-dashed flex items-center justify-center">
                        <MousePointer className="h-4 w-4 text-brand-500" />
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-3 w-3 text-brand-400" />
                          <span className="text-xs text-brand-400 font-medium">AI Generated</span>
                        </div>
                        <div className="h-2 w-3/4 bg-white/30 rounded" />
                      </div>
                    </div>
                  </div>
                  {/* Right Panel - AI Features */}
                  <div className="w-1/4 space-y-3">
                    <div className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-brand-600" />
                        <span className="text-xs font-medium">AI Assistant</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full bg-muted rounded" />
                        <div className="h-2 w-3/4 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium">Analytics</span>
                      </div>
                      <div className="flex items-end gap-1 h-12">
                        {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                          <div key={i} className="flex-1 bg-brand-200 dark:bg-brand-800 rounded-sm" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium">Languages</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {['EN', 'ES', 'FR', 'DE', 'JP'].map((lang) => (
                          <Badge key={lang} variant="secondary" className="text-[10px] px-1.5 py-0">{lang}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Logos/Trust Section */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground mb-8">Trusted by innovative teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-50">
            {['Stripe', 'Vercel', 'Linear', 'Notion', 'Figma', 'Shopify'].map((company) => (
              <div key={company} className="text-xl font-bold text-muted-foreground font-display" data-testid={`logo-${company.toLowerCase()}`}>
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10x", label: "Faster documentation", id: "faster" },
              { value: "4+ hrs", label: "Saved per week", id: "hours-saved" },
              { value: "85%", label: "Fewer support tickets", id: "tickets" },
              { value: "50+", label: "Languages supported", id: "languages" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                data-testid={`stat-${stat.id}`}
              >
                <div className="text-4xl md:text-5xl font-display font-bold text-brand-600 dark:text-brand-400 mb-2" data-testid={`text-stat-value-${stat.id}`}>{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI-Powered Section */}
      <section id="ai-powered" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Gradient Glow Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-brand-500/30 via-purple-500/30 to-pink-500/30 blur-[100px] rounded-full" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-background/50 to-background" />
        </div>
        
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1.5 bg-gradient-to-r from-brand-100 to-purple-100 text-brand-700 border-0 dark:from-brand-900/30 dark:to-purple-900/30 dark:text-brand-300" data-testid="badge-ai-section">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              AI-Powered
            </Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-purple-600 to-pink-600 dark:from-brand-400 dark:via-purple-400 dark:to-pink-400">
              Let AI Do the Heavy Lifting
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our AI automatically generates professional descriptions, translates content, and adapts tone.
              Create documentation that feels handcrafted in seconds.
            </p>
          </motion.div>

          {/* AI Features Bento Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Smart Step Descriptions - Large Card */}
            <motion.div 
              className="lg:col-span-2 relative group"
              {...fadeInUp}
              transition={{ delay: 0.1 }}
              data-testid="card-ai-smart-descriptions"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Card className="relative p-8 h-full border-brand-200/50 dark:border-brand-800/50 bg-gradient-to-br from-brand-50/50 to-purple-50/50 dark:from-brand-950/30 dark:to-purple-950/30">
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white flex items-center justify-center mb-6">
                      <Wand2 className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 font-display">Smart Step Descriptions</h3>
                    <p className="text-muted-foreground mb-4">
                      AI automatically generates professional, clear instructions for every step. 
                      No more staring at a blank page or writing the same phrases over and over.
                    </p>
                    <ul className="space-y-2 text-sm">
                      {['Contextual understanding of your actions', 'Professional tone by default', 'Edit and customize anytime'].map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-4 w-4 text-brand-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:w-1/2">
                    <div className="bg-card rounded-xl border border-border p-4 shadow-lg">
                      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-brand-500" />
                        AI-Generated Description
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-brand-100 dark:bg-brand-900/30 rounded animate-pulse" />
                        <div className="h-3 w-5/6 bg-brand-100 dark:bg-brand-900/30 rounded animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <div className="h-3 w-4/6 bg-brand-100 dark:bg-brand-900/30 rounded animate-pulse" style={{ animationDelay: '0.2s' }} />
                      </div>
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready to publish
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Auto Translation */}
            <motion.div {...fadeInUp} transition={{ delay: 0.2 }} data-testid="card-ai-translation">
              <Card className="p-6 h-full">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center mb-4">
                  <Languages className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-display">Auto-Translation</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  One-click translation to 50+ languages. Reach global teams instantly.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {['EN', 'ES', 'FR', 'DE', 'JP', 'KO', 'ZH', 'PT', 'IT', 'RU'].map((lang) => (
                    <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                  ))}
                  <Badge variant="secondary" className="text-xs">+40</Badge>
                </div>
              </Card>
            </motion.div>

            {/* AI Summarization */}
            <motion.div {...fadeInUp} transition={{ delay: 0.3 }} data-testid="card-ai-summarization">
              <Card className="p-6 h-full">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-display">AI Summarization</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Generate executive summaries for stakeholders. Perfect for long guides.
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground mb-1">TL;DR</div>
                  <div className="h-2 w-full bg-muted rounded mb-1" />
                  <div className="h-2 w-3/4 bg-muted rounded" />
                </div>
              </Card>
            </motion.div>

            {/* Tone Adjustment */}
            <motion.div {...fadeInUp} transition={{ delay: 0.4 }} data-testid="card-ai-tone">
              <Card className="p-6 h-full">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-display">Tone Adjustment</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Switch between formal, casual, or technical styles with one click.
                </p>
                <div className="flex gap-2">
                  {['Formal', 'Casual', 'Technical'].map((tone) => (
                    <Badge key={tone} variant="outline" className="text-xs">{tone}</Badge>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Smart Redaction */}
            <motion.div {...fadeInUp} transition={{ delay: 0.5 }} data-testid="card-ai-redaction">
              <Card className="p-6 h-full border-red-200/50 dark:border-red-800/50">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 text-white flex items-center justify-center mb-4">
                  <EyeOff className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-display">Smart Redaction</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Auto-blur sensitive data like emails, passwords, and PII. Stay compliant.
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <Shield className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">GDPR & HIPAA Ready</span>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platform Features Mega Section */}
      <section id="features" className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1.5" data-testid="badge-features-section">
              Platform Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Everything You Need to Scale
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              From interactive demos to enterprise analytics, our platform has every tool 
              to create, manage, and optimize your documentation at scale.
            </p>
          </motion.div>

          {/* Interactive & Training Row */}
          <div className="mb-12">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Interactive & Training</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <motion.div {...fadeInUp} transition={{ delay: 0.1 }} data-testid="card-feature-interactive-demos">
                <Card className="p-6 h-full group">
                  <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <MousePointer className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold mb-2 font-display">Interactive Demos</h4>
                  <p className="text-muted-foreground text-sm">
                    Clickable walkthrough guides that let users interact with each step. Perfect for onboarding.
                  </p>
                </Card>
              </motion.div>

              <motion.div {...fadeInUp} transition={{ delay: 0.2 }} data-testid="card-feature-sandbox">
                <Card className="p-6 h-full group">
                  <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Box className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold mb-2 font-display">Sandbox Mode</h4>
                  <p className="text-muted-foreground text-sm">
                    Safe practice environments where users can learn without affecting real data.
                  </p>
                </Card>
              </motion.div>

              <motion.div {...fadeInUp} transition={{ delay: 0.3 }} data-testid="card-feature-video-hybrid">
                <Card className="p-6 h-full group">
                  <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Video className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold mb-2 font-display">Video + Screenshots</h4>
                  <p className="text-muted-foreground text-sm">
                    AI voiceovers combined with recorded explanations. Multi-modal documentation.
                  </p>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Smart Automation Row */}
          <div className="mb-12">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Smart Automation</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div {...fadeInUp} transition={{ delay: 0.1 }} data-testid="card-feature-templates">
                <Card className="p-6 h-full">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                      <LayoutTemplate className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold mb-2 font-display">Template Marketplace</h4>
                      <p className="text-muted-foreground text-sm mb-3">
                        Pre-built guide templates for common workflows. Get started instantly with proven structures.
                      </p>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="text-xs">Onboarding</Badge>
                        <Badge variant="secondary" className="text-xs">Support</Badge>
                        <Badge variant="secondary" className="text-xs">Sales</Badge>
                        <Badge variant="secondary" className="text-xs">+50</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div {...fadeInUp} transition={{ delay: 0.2 }} data-testid="card-feature-version-history">
                <Card className="p-6 h-full">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <History className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold mb-2 font-display">Version History</h4>
                      <p className="text-muted-foreground text-sm mb-3">
                        Track every change with full rollback capability. Never lose work again.
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Unlimited versions</span>
                        <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Compare diffs</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Analytics Row */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Analytics & Insights</h3>
            <div className="grid md:grid-cols-5 gap-6">
              <motion.div className="md:col-span-3" {...fadeInUp} transition={{ delay: 0.1 }} data-testid="card-feature-analytics">
                <Card className="p-6 h-full">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center mb-4">
                        <BarChart3 className="h-6 w-6" />
                      </div>
                      <h4 className="text-xl font-bold mb-2 font-display">Analytics Dashboard</h4>
                      <p className="text-muted-foreground text-sm mb-4">
                        Track views, completion rates, engagement metrics, and more. Understand how your documentation performs.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Views', value: '12.4K', change: '+23%' },
                          { label: 'Completion', value: '89%', change: '+5%' },
                          { label: 'Avg. Time', value: '2.3m', change: '-12%' },
                          { label: 'Shares', value: '847', change: '+67%' },
                        ].map((metric) => (
                          <div key={metric.label} className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold">{metric.value}</span>
                              <span className="text-xs text-green-600">{metric.change}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="lg:w-1/3">
                      <div className="bg-muted/30 rounded-xl p-4 h-full">
                        <div className="text-xs text-muted-foreground mb-3">Weekly Views</div>
                        <div className="flex items-end gap-1 h-32">
                          {[45, 62, 38, 78, 55, 90, 85].map((h, i) => (
                            <div key={i} className="flex-1 bg-gradient-to-t from-brand-500 to-brand-400 rounded-sm" style={{ height: `${h}%` }} />
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                          <span>Mon</span>
                          <span>Sun</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div className="md:col-span-2" {...fadeInUp} transition={{ delay: 0.2 }} data-testid="card-feature-bottleneck">
                <Card className="p-6 h-full border-amber-200/50 dark:border-amber-800/50">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center mb-4">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-2 font-display">Bottleneck Identification</h4>
                  <p className="text-muted-foreground text-sm mb-4">
                    AI automatically identifies confusing steps where users drop off or get stuck.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Step 3: Configure Settings</span>
                      <Badge variant="destructive" className="text-xs">High drop-off</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Step 7: API Integration</span>
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Needs review</Badge>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1.5" data-testid="badge-integrations-section">
              Integrations
            </Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Works Where You Work
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Seamlessly integrate with your favorite tools. Share guides in Slack, 
              embed in Notion, or build custom workflows with our API.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div {...fadeInUp} transition={{ delay: 0.1 }} data-testid="card-integration-slack">
              <Card className="p-6 h-full text-center group">
                <div className="h-16 w-16 rounded-2xl bg-[#4A154B]/10 dark:bg-[#4A154B]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <SiSlack className="h-8 w-8 text-[#4A154B] dark:text-[#E01E5A]" />
                </div>
                <h4 className="text-lg font-bold mb-2 font-display">Slack/Teams Bot</h4>
                <p className="text-muted-foreground text-sm">
                  Share guides directly in chat. Search and access docs without leaving your workflow.
                </p>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.2 }} data-testid="card-integration-guide-hub">
              <Card className="p-6 h-full text-center group">
                <div className="h-16 w-16 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <BookOpen className="h-8 w-8 text-brand-600" />
                </div>
                <h4 className="text-lg font-bold mb-2 font-display">Public Guide Hub</h4>
                <p className="text-muted-foreground text-sm">
                  Create a branded knowledge base. Your own docs portal with custom domain.
                </p>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.3 }} data-testid="card-integration-custom-domains">
              <Card className="p-6 h-full text-center group">
                <div className="h-16 w-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Globe2 className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="text-lg font-bold mb-2 font-display">Custom Domains</h4>
                <p className="text-muted-foreground text-sm">
                  White-label hosting on your own domain. Full brand control.
                </p>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.4 }} data-testid="card-integration-api">
              <Card className="p-6 h-full text-center group">
                <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Code className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h4 className="text-lg font-bold mb-2 font-display">API Access</h4>
                <p className="text-muted-foreground text-sm">
                  Full REST API for custom integrations. Build anything you can imagine.
                </p>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section id="enterprise" className="py-24 bg-gradient-to-br from-gray-900 to-gray-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNHMxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <Badge className="mb-4 rounded-full px-4 py-1.5 bg-white/10 text-white border-white/20" data-testid="badge-enterprise-section">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Enterprise Ready
            </Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Built for Security-Conscious Teams
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Enterprise-grade security, compliance, and control. 
              Deploy with confidence for your entire organization.
            </p>
          </motion.div>

          {/* Enterprise Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: Key, title: 'SSO/SAML', desc: 'Enterprise authentication with Okta, Azure AD, and more', id: 'sso' },
              { icon: ClipboardList, title: 'Audit Logs', desc: 'Complete compliance tracking for every action', id: 'audit' },
              { icon: ShieldCheck, title: 'Data Privacy', desc: 'GDPR, HIPAA, and SOC 2 compliant', id: 'privacy' },
              { icon: Lock, title: 'Role-Based Access', desc: 'Granular permissions for teams and users', id: 'rbac' },
            ].map((feature, i) => (
              <motion.div 
                key={feature.id}
                {...fadeInUp}
                transition={{ delay: i * 0.1 }}
                data-testid={`card-enterprise-${feature.id}`}
              >
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full">
                  <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold mb-2 font-display">{feature.title}</h4>
                  <p className="text-white/60 text-sm">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Trust Badges */}
          <motion.div 
            className="text-center"
            {...fadeInUp}
          >
            <p className="text-sm text-white/50 mb-6">Trusted by security-conscious organizations</p>
            <div className="flex flex-wrap items-center justify-center gap-8" data-testid="enterprise-trust-badges">
              {[
                { label: 'SOC 2', sublabel: 'Type II' },
                { label: 'GDPR', sublabel: 'Compliant' },
                { label: 'HIPAA', sublabel: 'Ready' },
                { label: '99.9%', sublabel: 'Uptime SLA' },
              ].map((badge) => (
                <div key={badge.label} className="flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-2">
                    <span className="font-bold text-sm">{badge.label}</span>
                  </div>
                  <span className="text-xs text-white/50">{badge.sublabel}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From click to share in three simple steps. No learning curve, no complex setup.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-20 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 dark:from-brand-800 dark:via-brand-600 dark:to-brand-800" />
            
            {[
              { num: 1, icon: Download, title: 'Install Extension', desc: 'Add our free Chrome extension in one click. Takes less than 10 seconds to get started.', cta: true, id: 'install' },
              { num: 2, icon: Camera, title: 'Record Your Workflow', desc: 'Click record and use your app normally. We capture every click, form fill, and navigation with screenshots.', id: 'record' },
              { num: 3, icon: Send, title: 'Share Instantly', desc: 'Click stop and your guide is ready. Share a link, export to PDF, or embed in your docs. No editing required.', id: 'share' },
            ].map((step, i) => (
              <motion.div 
                key={step.id}
                {...fadeInUp}
                transition={{ delay: i * 0.15 }}
                className="text-center relative"
                data-testid={`step-${step.id}`}
              >
                <div className="h-16 w-16 rounded-full bg-brand-600 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg shadow-brand-500/30 relative z-10">
                  {step.num}
                </div>
                <div className="h-14 w-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">{step.title}</h3>
                <p className="text-muted-foreground mb-4">{step.desc}</p>
                {step.cta && (
                  <Button size="sm" className="rounded-full bg-brand-600 text-white" asChild>
                    <a href="#install-extension" data-testid="button-step-install">
                      <SiGooglechrome className="mr-2 h-4 w-4" />
                      Get Extension
                    </a>
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Install Extension CTA Section */}
      <section id="install-extension" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-brand-50 to-purple-50 dark:from-brand-950/50 dark:to-purple-950/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-brand-600 text-white mb-6 shadow-lg shadow-brand-500/30">
              <SiGooglechrome className="h-10 w-10" />
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Get Started in 60 Seconds
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Install our free Chrome extension and start capturing workflows instantly. 
              No account required to try it out.
            </p>
            <Button size="lg" className="rounded-full text-lg h-14 px-10 bg-brand-600 text-white shadow-xl shadow-brand-500/30 transition-all" asChild>
              <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" data-testid="button-install-extension-cta">
                <SiGooglechrome className="mr-2 h-5 w-5" />
                Install Free Extension
              </a>
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm mt-6">
              <span className="flex items-center gap-2" data-testid="text-extension-free"><Check className="h-4 w-4 text-brand-600" /> 100% Free</span>
              <span className="flex items-center gap-2" data-testid="text-extension-works"><Check className="h-4 w-4 text-brand-600" /> Works on any website</span>
              <span className="flex items-center gap-2" data-testid="text-extension-private"><Check className="h-4 w-4 text-brand-600" /> Private & secure</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Loved by Teams Everywhere</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See why thousands of teams trust FlowCapture for their documentation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "We went from spending 6 hours a week on documentation to 45 minutes. The AI features are a game-changer.",
                author: "Sarah Chen",
                role: "Head of Customer Success",
                company: "TechStart Inc",
                rating: 5
              },
              {
                quote: "The auto-translation feature alone saved us $20K in localization costs. Now all our guides are available in 12 languages.",
                author: "Michael Torres",
                role: "VP of Operations",
                company: "GlobalCorp",
                rating: 5
              },
              {
                quote: "Interactive demos have transformed our onboarding. New hires are productive in days, not weeks.",
                author: "Jessica Park",
                role: "Training Director",
                company: "ScaleUp Agency",
                rating: 5
              }
            ].map((testimonial, i) => (
              <motion.div 
                key={i}
                {...fadeInUp}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Quote className="h-8 w-8 text-brand-200 dark:text-brand-800 mb-2" />
                  <p className="text-muted-foreground flex-1 mb-6">{testimonial.quote}</p>
                  <div className="border-t border-border pt-4">
                    <div className="font-semibold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.company}</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            {...fadeInUp}
          >
            <Badge variant="secondary" className="rounded-full px-4 py-1.5 mb-6 bg-brand-100 text-brand-700 border border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800">
              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
              Simple Pricing
            </Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Choose Your Plan</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free and scale as your team grows. No hidden fees, cancel anytime.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <motion.div {...fadeInUp}>
              <Card className="p-8 h-full flex flex-col relative overflow-visible">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold font-display mb-2">Free</h3>
                  <p className="text-muted-foreground">Perfect for individuals getting started</p>
                </div>
                <div className="mb-6">
                  <span className="text-5xl font-bold font-display">$0</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>1 workspace</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>1 user</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Unlimited guides</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Chrome extension</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Screenshot capture</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Basic export options</span>
                  </li>
                </ul>
                <Button size="lg" variant="outline" className="w-full rounded-full" asChild>
                  <a href="/api/login" data-testid="button-pricing-free">Get Started Free</a>
                </Button>
              </Card>
            </motion.div>

            {/* Paid Plan */}
            <motion.div {...fadeInUp} transition={{ delay: 0.1 }}>
              <Card className="p-8 h-full flex flex-col relative overflow-visible border-2 border-brand-500">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white rounded-full px-4">
                  Most Popular
                </Badge>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold font-display mb-2">Pro</h3>
                  <p className="text-muted-foreground">For teams and growing organizations</p>
                </div>
                <div className="mb-6">
                  <span className="text-5xl font-bold font-display">$23</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                  <div className="text-sm text-muted-foreground mt-1">
                    + $7/month per additional user
                  </div>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Unlimited workspaces</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>1 user included, add more anytime</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Unlimited guides</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>AI-powered descriptions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Screenshot beautification</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Team collaboration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Analytics dashboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <Button size="lg" className="w-full rounded-full bg-brand-600 text-white" asChild>
                  <a href="/api/login" data-testid="button-pricing-pro">Start Pro Trial</a>
                </Button>
              </Card>
            </motion.div>
          </div>

          <motion.div 
            className="text-center mt-12"
            {...fadeInUp}
          >
            <p className="text-muted-foreground">
              Need a custom enterprise solution?{' '}
              <a href="#enterprise" className="text-brand-600 font-medium hover:underline">Contact our sales team</a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-br from-brand-600 to-brand-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNHMxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Ready to Transform Your Documentation?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Join thousands of teams who've eliminated the documentation grind. 
              Start capturing workflows in seconds, not hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Button size="lg" className="rounded-full text-lg h-14 px-8 bg-white text-brand-700 shadow-xl transition-all" asChild>
                <a href="/api/login" data-testid="button-cta-final">Start Free Today <ArrowRight className="ml-2 h-5 w-5" /></a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full text-lg h-14 px-8 border-2 border-white/30 text-white bg-white/10 backdrop-blur-sm" asChild>
                <a href="#enterprise" data-testid="button-cta-enterprise">Contact Sales</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-white/70 text-sm">
              <span className="flex items-center gap-2" data-testid="text-cta-free"><Check className="h-4 w-4" /> Free forever for individuals</span>
              <span className="flex items-center gap-2" data-testid="text-cta-no-cc"><Check className="h-4 w-4" /> No credit card required</span>
              <span className="flex items-center gap-2" data-testid="text-cta-setup"><Check className="h-4 w-4" /> Set up in 2 minutes</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                {branding?.logoUrl ? (
                  <img src={branding.logoUrl} alt={siteName} className="h-8 w-8 object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
                    {siteName.charAt(0)}
                  </div>
                )}
                <span className="font-display font-bold text-xl tracking-tight">{siteName}</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                The AI-powered documentation platform for modern teams. Create, translate, and share guides in seconds.
              </p>
              <div className="flex gap-4">
                <Button size="icon" variant="ghost" asChild>
                  <a href="#" aria-label="Twitter" data-testid="link-footer-twitter">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                </Button>
                <Button size="icon" variant="ghost" asChild>
                  <a href="#" aria-label="LinkedIn" data-testid="link-footer-linkedin">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors" data-testid="link-footer-features">Features</a></li>
                <li><a href="#ai-powered" className="hover:text-foreground transition-colors" data-testid="link-footer-ai">AI Features</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors" data-testid="link-footer-how-it-works">How It Works</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-pricing">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-extension">Chrome Extension</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Solutions</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-support">Customer Support</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-training">Employee Training</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-product">Product Teams</a></li>
                <li><a href="#enterprise" className="hover:text-foreground transition-colors" data-testid="link-footer-enterprise">Enterprise</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-about">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-blog">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-careers">Careers</a></li>
                {footerPages.map((page) => (
                  <li key={page.id}>
                    <a 
                      href={`/pages/${page.slug}`} 
                      className="hover:text-foreground transition-colors" 
                      data-testid={`link-footer-page-${page.slug}`}
                    >
                      {page.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Status</a>
              <a href="#" className="hover:text-foreground transition-colors">Security</a>
              <a href="#" className="hover:text-foreground transition-colors">Sitemap</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
