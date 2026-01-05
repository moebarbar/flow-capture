import { lazy, Suspense, memo } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const GuideEditor = lazy(() => import("@/pages/GuideEditor"));
const GuidesList = lazy(() => import("@/pages/GuidesList"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const AdminPage = lazy(() => import("@/pages/admin"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const AnalyticsDashboard = lazy(() => import("@/pages/AnalyticsDashboard"));
const TemplateLibrary = lazy(() => import("@/pages/TemplateLibrary"));
const WorkspaceSettingsPage = lazy(() => import("@/pages/WorkspaceSettingsPage"));
const ScreenshotStudio = lazy(() => import("@/pages/ScreenshotStudio"));
const SharedGuidePage = lazy(() => import("@/pages/SharedGuidePage"));
const EmbedGuidePage = lazy(() => import("@/pages/EmbedGuidePage"));
const ContentPage = lazy(() => import("@/pages/ContentPage"));
const TeamDashboard = lazy(() => import("@/pages/TeamDashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

const PageLoader = memo(function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
});

const ProtectedRoute = memo(function ProtectedRoute({ 
  component: Component 
}: { 
  component: React.LazyExoticComponent<React.ComponentType<any>> 
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
});

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Switch>
      <Route path="/">
        {() => (
          <Suspense fallback={<PageLoader />}>
            {user ? <Dashboard /> : <LandingPage />}
          </Suspense>
        )}
      </Route>
      <Route path="/auth">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <AuthPage />
          </Suspense>
        )}
      </Route>
      
      {/* Public Routes */}
      <Route path="/pricing">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <PricingPage />
          </Suspense>
        )}
      </Route>
      <Route path="/checkout/success">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <CheckoutSuccessPage />
          </Suspense>
        )}
      </Route>
      <Route path="/share/:token">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <SharedGuidePage />
          </Suspense>
        )}
      </Route>
      <Route path="/embed/:token">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <EmbedGuidePage />
          </Suspense>
        )}
      </Route>
      <Route path="/pages/:slug">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <ContentPage />
          </Suspense>
        )}
      </Route>
      
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
      <Route path="/workspaces/:workspaceId/team">
        {() => <ProtectedRoute component={TeamDashboard} />}
      </Route>

      <Route>
        {() => (
          <Suspense fallback={<PageLoader />}>
            <NotFound />
          </Suspense>
        )}
      </Route>
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
