import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import GuideEditor from "@/pages/GuideEditor";
import GuidesList from "@/pages/GuidesList";
import AuthPage from "@/pages/AuthPage";
import AdminPage from "@/pages/admin";
import PricingPage from "@/pages/pricing";
import CheckoutSuccessPage from "@/pages/checkout-success";
import SettingsPage from "@/pages/settings";
import AnalyticsDashboard from "@/pages/AnalyticsDashboard";
import TemplateLibrary from "@/pages/TemplateLibrary";
import WorkspaceSettingsPage from "@/pages/WorkspaceSettingsPage";
import ScreenshotStudio from "@/pages/ScreenshotStudio";
import SharedGuidePage from "@/pages/SharedGuidePage";
import EmbedGuidePage from "@/pages/EmbedGuidePage";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect handled in LandingPage or explicitly here
    window.location.href = "/";
    return null;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={user ? Dashboard : LandingPage} />
      <Route path="/auth" component={AuthPage} />
      
      {/* Public Routes */}
      <Route path="/pricing" component={PricingPage} />
      <Route path="/checkout/success" component={CheckoutSuccessPage} />
      <Route path="/share/:token" component={SharedGuidePage} />
      <Route path="/embed/:token" component={EmbedGuidePage} />
      
      {/* Protected Routes */}
      <Route path="/guides">
        {() => <ProtectedRoute component={GuidesList} />}
      </Route>
      <Route path="/guides/:id/edit">
        {() => <ProtectedRoute component={GuideEditor} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={SettingsPage} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={AnalyticsDashboard} />}
      </Route>
      <Route path="/templates">
        {() => <ProtectedRoute component={TemplateLibrary} />}
      </Route>
      <Route path="/workspace-settings">
        {() => <ProtectedRoute component={WorkspaceSettingsPage} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPage} />}
      </Route>
      <Route path="/studio">
        {() => <ProtectedRoute component={ScreenshotStudio} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
