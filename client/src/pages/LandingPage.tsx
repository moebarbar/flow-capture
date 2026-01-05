import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  Check, ArrowRight, Zap, Share2, Layers, Clock, DollarSign, 
  Users, GraduationCap, Headphones, TrendingUp, MousePointer, 
  Camera, FileText, Send, Quote, Building2, Briefcase, Download
} from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
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

export default function LandingPage() {
  const { user } = useAuth();

  const { data: branding } = useQuery<SiteSettings>({
    queryKey: ['/api/settings/public'],
  });

  const siteName = branding?.siteName || "FlowCapture";

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
          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <a href="/api/login" data-testid="link-nav-login">Log in</a>
            </Button>
            <Button asChild className="rounded-full px-6 bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/25">
              <a href="/api/login" data-testid="link-nav-get-started">Get Started <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-brand-100/50 to-transparent dark:from-brand-950/30 -z-10 blur-3xl rounded-full opacity-60" />
        
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-brand-100 text-brand-700 font-medium text-sm mb-6 border border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800" data-testid="text-trust-badge">
              Trusted by 500+ teams worldwide
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight mb-6 pb-2 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-brand-800 to-brand-600 dark:from-white dark:via-brand-200 dark:to-brand-400">
              Stop writing docs. <br /> Start capturing them.
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed">
              FlowCapture automatically creates step-by-step documentation with screenshots as you work. 
              Just click through any workflow and get a shareable guide in seconds.
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              <span className="text-foreground font-semibold">Save 4+ hours per week</span> on documentation. 
              No more screenshots, no more writing instructions, no more outdated guides.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="rounded-full text-lg h-14 px-8 bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-1" asChild>
                <a href={branding?.extensionLink || "#install-extension"} target={branding?.extensionLink?.startsWith('http') ? "_blank" : undefined} rel={branding?.extensionLink?.startsWith('http') ? "noopener noreferrer" : undefined} data-testid="button-hero-install-extension">
                  <SiGooglechrome className="mr-2 h-5 w-5" />
                  Get the Extension, it's free
                </a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full text-lg h-14 px-8 border-2 hover:bg-muted/50" asChild>
                <a href={branding?.demoLink || "#how-it-works"} target={branding?.demoLink?.startsWith('http') ? "_blank" : undefined} rel={branding?.demoLink?.startsWith('http') ? "noopener noreferrer" : undefined} data-testid="link-how-it-works">See How It Works</a>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Free forever for individuals. No credit card required.
            </p>
          </motion.div>

          {/* Product Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 relative mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card/50 backdrop-blur-sm">
              <div className="h-8 bg-muted/50 border-b border-border flex items-center px-4 gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <div className="h-3 w-3 rounded-full bg-green-400/80" />
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-brand-50 to-brand-100/50 flex items-center justify-center relative overflow-hidden dark:from-gray-900 dark:to-gray-800">
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-3/4 h-3/4 bg-white dark:bg-black rounded-xl shadow-lg border border-border p-6 flex gap-6">
                      <div className="w-1/4 h-full bg-muted/30 rounded-lg space-y-3 p-3">
                         <div className="h-2 w-1/2 bg-muted rounded" />
                         <div className="h-16 w-full bg-brand-100/50 rounded border border-brand-200" />
                         <div className="h-16 w-full bg-white dark:bg-gray-900 rounded border border-border" />
                         <div className="h-16 w-full bg-white dark:bg-gray-900 rounded border border-border" />
                      </div>
                      <div className="flex-1 h-full bg-muted/20 rounded-lg border border-border flex items-center justify-center text-muted-foreground/30 font-display text-4xl font-bold">
                        SCREENSHOT
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10x", label: "Faster documentation", id: "faster" },
              { value: "4+ hrs", label: "Saved per week", id: "hours-saved" },
              { value: "85%", label: "Fewer support tickets", id: "tickets" },
              { value: "$12K", label: "Avg. annual savings", id: "savings" }
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

      {/* Install Extension CTA Section */}
      <section id="install-extension" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-brand-50 to-brand-100/50 dark:from-brand-950/50 dark:to-brand-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-brand-600 text-white mb-6 shadow-lg shadow-brand-500/30">
              <SiGooglechrome className="h-10 w-10" />
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Step 1: Install the Chrome Extension
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Get started in under 60 seconds. Install our free Chrome extension to begin capturing workflows instantly. 
              No account required to try it out.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button size="lg" className="rounded-full text-lg h-14 px-10 bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-1" asChild>
                <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" data-testid="button-install-extension-cta">
                  <SiGooglechrome className="mr-2 h-5 w-5" />
                  Get the Extension, it's free
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm">
              <span className="flex items-center gap-2" data-testid="text-extension-free"><Check className="h-4 w-4 text-brand-600" /> 100% Free</span>
              <span className="flex items-center gap-2" data-testid="text-extension-works"><Check className="h-4 w-4 text-brand-600" /> Works on any website</span>
              <span className="flex items-center gap-2" data-testid="text-extension-private"><Check className="h-4 w-4 text-brand-600" /> Private & secure</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Who Uses Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Who Uses FlowCapture?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              From startups to enterprises, teams across every department rely on FlowCapture to save time and improve clarity.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Headphones,
                title: "Customer Support",
                desc: "Create help articles and troubleshooting guides instantly. Reduce ticket volume by giving customers self-service docs.",
                stat: "85% fewer repeat questions",
                id: "support"
              },
              {
                icon: GraduationCap,
                title: "Training & HR",
                desc: "Onboard new employees faster with visual step-by-step guides. No more shadowing or screen-share sessions.",
                stat: "50% faster onboarding",
                id: "training"
              },
              {
                icon: Users,
                title: "Product Teams",
                desc: "Document features for QA, sales, and customers. Keep everyone aligned with always up-to-date guides.",
                stat: "3x more documentation output",
                id: "product"
              },
              {
                icon: TrendingUp,
                title: "Sales & Success",
                desc: "Create personalized demo walkthroughs and implementation guides that close deals faster.",
                stat: "40% faster deal cycles",
                id: "sales"
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                data-testid={`card-audience-${item.id}`}
              >
                <Card className="p-6 h-full flex flex-col">
                  <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-display">{item.title}</h3>
                  <p className="text-muted-foreground flex-1 mb-4">{item.desc}</p>
                  <div className="text-sm font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1" data-testid={`text-audience-stat-${item.id}`}>
                    <Check className="h-4 w-4" />
                    {item.stat}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why FlowCapture Section */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Why FlowCapture?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Documentation shouldn't eat up your entire day. We built FlowCapture to eliminate the busywork.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                title: "Save Hours Every Week",
                desc: "Traditional documentation takes 30-60 minutes per guide. FlowCapture does it in under 2 minutes. That's 4+ hours back in your week.",
                highlight: "Average time to create a guide: 47 seconds",
                id: "time"
              },
              {
                icon: DollarSign,
                title: "Cut Documentation Costs",
                desc: "Stop paying expensive contractors or burning senior employee time on repetitive documentation work.",
                highlight: "Teams save $12,000+ annually",
                id: "cost"
              },
              {
                icon: Zap,
                title: "Always Up-to-Date",
                desc: "When your product changes, just re-record the workflow. No more hunting through old docs to update screenshots manually.",
                highlight: "Update any guide in 60 seconds",
                id: "fresh"
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-card p-8 rounded-2xl border border-border shadow-sm"
                data-testid={`card-benefit-${feature.id}`}
              >
                <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">{feature.title}</h3>
                <p className="text-muted-foreground mb-4">{feature.desc}</p>
                <div className="text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-2 rounded-lg inline-block" data-testid={`text-benefit-highlight-${feature.id}`}>
                  {feature.highlight}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              From click to share in three simple steps. No learning curve, no complex setup.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection Lines */}
            <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 dark:from-brand-800 dark:via-brand-600 dark:to-brand-800" />
            
            {/* Step 1 - Install Extension */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              viewport={{ once: true }}
              className="text-center relative"
              data-testid="step-install"
            >
              <div className="h-16 w-16 rounded-full bg-brand-600 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg shadow-brand-500/30 relative z-10">
                1
              </div>
              <div className="h-14 w-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
                <Download className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">Install Extension</h3>
              <p className="text-muted-foreground mb-4">Add our free Chrome extension in one click. Takes less than 10 seconds to get started.</p>
              <Button size="sm" className="rounded-full bg-brand-600 hover:bg-brand-700 text-white" asChild>
                <a href="#install-extension" data-testid="button-step-install">
                  <SiGooglechrome className="mr-2 h-4 w-4" />
                  Get Extension, it's free
                </a>
              </Button>
            </motion.div>

            {/* Step 2 - Record Workflow */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              viewport={{ once: true }}
              className="text-center relative"
              data-testid="step-record"
            >
              <div className="h-16 w-16 rounded-full bg-brand-600 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg shadow-brand-500/30 relative z-10">
                2
              </div>
              <div className="h-14 w-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
                <Camera className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">Record Your Workflow</h3>
              <p className="text-muted-foreground">Click record and use your app normally. We capture every click, form fill, and navigation with screenshots.</p>
            </motion.div>

            {/* Step 3 - Share */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="text-center relative"
              data-testid="step-share"
            >
              <div className="h-16 w-16 rounded-full bg-brand-600 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg shadow-brand-500/30 relative z-10">
                3
              </div>
              <div className="h-14 w-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-4">
                <Send className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">Share Instantly</h3>
              <p className="text-muted-foreground">Click stop and your guide is ready. Share a link, export to PDF, or embed in your docs. No editing required.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Packed with Powerful Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Everything you need to create, organize, and share documentation at scale.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Camera,
                title: "Auto Screenshots",
                desc: "Every click automatically captures a high-quality screenshot with the element highlighted."
              },
              {
                icon: FileText,
                title: "AI Descriptions",
                desc: "Our AI writes clear, natural-language instructions for each step. Edit if you want, or ship as-is."
              },
              {
                icon: Layers,
                title: "Organized Workspaces",
                desc: "Keep guides organized by team, project, or topic. Folders and search make finding docs instant."
              },
              {
                icon: Share2,
                title: "One-Click Sharing",
                desc: "Share via link, embed in Notion/Confluence, or export to PDF. Viewers don't need an account."
              },
              {
                icon: Users,
                title: "Team Collaboration",
                desc: "Invite your whole team. Role-based permissions ensure the right people can edit or view."
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                desc: "No lag, no waiting. Capture at full speed and get your guide the moment you stop recording."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
              >
                <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Real Results from Real Teams</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              See how teams are transforming their documentation workflow with FlowCapture.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Building2,
                company: "SaaS Startup",
                industry: "B2B Software",
                quote: "We went from spending 6 hours a week on documentation to 45 minutes. Our support team can now focus on complex issues instead of writing the same guides over and over.",
                author: "Sarah Chen",
                role: "Head of Customer Success",
                stats: [
                  { label: "Time saved weekly", value: "5+ hours" },
                  { label: "Support tickets reduced", value: "73%" }
                ]
              },
              {
                icon: Briefcase,
                company: "Enterprise Corp",
                industry: "Financial Services",
                quote: "Onboarding new hires used to take 3 weeks of shadowing. Now they have video-quality guides for every process. We cut onboarding time in half.",
                author: "Michael Torres",
                role: "VP of Operations",
                stats: [
                  { label: "Onboarding time", value: "-50%" },
                  { label: "Guides created", value: "400+" }
                ]
              },
              {
                icon: Users,
                company: "Agency Team",
                industry: "Marketing Agency",
                quote: "Client handoffs are seamless now. We record the workflow once and they have perfect documentation forever. It's a game-changer for client relationships.",
                author: "Jessica Park",
                role: "Account Director",
                stats: [
                  { label: "Client satisfaction", value: "+40%" },
                  { label: "Handoff time", value: "-80%" }
                ]
              }
            ].map((study, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <study.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold">{study.company}</div>
                      <div className="text-sm text-muted-foreground">{study.industry}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <Quote className="h-8 w-8 text-brand-200 dark:text-brand-800 mb-2" />
                    <p className="text-muted-foreground italic mb-4">{study.quote}</p>
                  </div>

                  <div className="border-t border-border pt-4 mt-4">
                    <div className="font-medium">{study.author}</div>
                    <div className="text-sm text-muted-foreground mb-4">{study.role}</div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {study.stats.map((stat, j) => (
                        <div key={j} className="text-center bg-muted/50 rounded-lg py-2 px-3">
                          <div className="text-lg font-bold text-brand-600 dark:text-brand-400">{stat.value}</div>
                          <div className="text-xs text-muted-foreground">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-br from-brand-600 to-brand-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNHMxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
              Ready to 10x Your Documentation?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Join thousands of teams who've eliminated the documentation grind. 
              Start capturing workflows in seconds, not hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Button size="lg" className="rounded-full text-lg h-14 px-8 bg-white text-brand-700 hover:bg-white/90 shadow-xl transition-all hover:-translate-y-1" asChild>
                <a href="/api/login" data-testid="button-cta-final">Start Free Today <ArrowRight className="ml-2 h-5 w-5" /></a>
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
      <footer className="py-12 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
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
              <p className="text-sm text-muted-foreground">
                The fastest way to create and share workflow documentation.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors" data-testid="link-footer-how-it-works">How It Works</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-pricing">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-extension">Chrome Extension</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Use Cases</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-support">Customer Support</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-training">Employee Training</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-product">Product Teams</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-about">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-privacy">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors" data-testid="link-footer-terms">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
