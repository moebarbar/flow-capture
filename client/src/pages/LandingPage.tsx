import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, ArrowRight, Zap, Share2, Layers } from "lucide-react";
import { useEffect } from "react";

export default function LandingPage() {
  const { user } = useAuth();

  // Redirect if logged in
  useEffect(() => {
    if (user) {
      window.location.href = "/";
    }
  }, [user]);

  if (user) return null; // Prevent flash

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand-200 selection:text-brand-900">
      {/* Navbar */}
      <nav className="fixed w-full z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
              W
            </div>
            <span className="font-display font-bold text-xl tracking-tight">WorkflowCapture</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <a href="/api/login">Log in</a>
            </Button>
            <Button asChild className="rounded-full px-6 bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/25">
              <a href="/api/login">Get Started <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-brand-100/50 to-transparent dark:from-brand-950/30 -z-10 blur-3xl rounded-full opacity-60" />
        
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-brand-100 text-brand-700 font-medium text-sm mb-6 border border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800">
              🚀 The fastest way to create documentation
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-brand-800 to-brand-600 dark:from-white dark:via-brand-200 dark:to-brand-400">
              Capture workflows <br /> in seconds, not hours.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Automatically generate step-by-step guides with screenshots just by clicking through your workflow. Share instantly with your team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="rounded-full text-lg h-14 px-8 bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-500/30 transition-all hover:-translate-y-1" asChild>
                <a href="/api/login">Start Capturing Free</a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full text-lg h-14 px-8 border-2 hover:bg-muted/50" asChild>
                <a href="#features">See How It Works</a>
              </Button>
            </div>
          </motion.div>

          {/* Product Preview Image */}
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
              {/* Using a placeholder that represents the UI */}
              <div className="aspect-[16/9] bg-gradient-to-br from-brand-50 to-brand-100/50 flex items-center justify-center relative overflow-hidden dark:from-gray-900 dark:to-gray-800">
                <div className="absolute inset-0 flex items-center justify-center">
                   {/* Abstract UI Representation */}
                   <div className="w-3/4 h-3/4 bg-white dark:bg-black rounded-xl shadow-lg border border-border p-6 flex gap-6">
                      <div className="w-1/4 h-full bg-muted/30 rounded-lg space-y-3 p-3">
                         <div className="h-2 w-1/2 bg-muted rounded" />
                         <div className="h-16 w-full bg-brand-100/50 rounded border border-brand-200" />
                         <div className="h-16 w-full bg-white rounded border border-border" />
                         <div className="h-16 w-full bg-white rounded border border-border" />
                      </div>
                      <div className="flex-1 h-full bg-muted/20 rounded-lg border border-border dashed flex items-center justify-center text-muted-foreground/30 font-display text-4xl font-bold">
                        SCREENSHOT
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">Why teams love WorkflowCapture</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built for speed and clarity. Stop writing docs manually and start capturing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                desc: "Capture workflows 10x faster than traditional screenshots and copy-pasting."
              },
              {
                icon: Layers,
                title: "Auto-Magic Context",
                desc: "We automatically detect clicked elements, URLs, and actions to write descriptions for you."
              },
              {
                icon: Share2,
                title: "Instant Sharing",
                desc: "Share a link or export to PDF/HTML instantly. No login required for viewers."
              }
            ].map((feature, i) => (
              <div key={i} className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                <div className="h-12 w-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 WorkflowCapture Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
