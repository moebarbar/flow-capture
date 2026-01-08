import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, CreditCard, User, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarProvider, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function SettingsPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { isCollapsed } = useSidebarState();

  const { data: subscriptionData, isLoading: subLoading } = useQuery<{
    subscription: any;
    status: string;
  }>({
    queryKey: ['/api/subscription'],
    enabled: !!user,
    staleTime: 60000,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/portal');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({ title: "Failed to open billing portal", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <main className={cn(
          "flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-200",
          "lg:ml-64",
          isCollapsed && "lg:ml-16"
        )}>
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  const subscriptionStatus = subscriptionData?.status || 'inactive';
  const hasActiveSubscription = subscriptionStatus === 'active';

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <MobileMenuTrigger />
            <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
              <p className="text-muted-foreground text-sm">Manage your account and subscription</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                <CardTitle className="text-base sm:text-lg">Account</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Name</p>
                  <p className="font-medium text-sm sm:text-base" data-testid="text-user-name">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-sm sm:text-base truncate" data-testid="text-user-email">
                    {user?.email}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Role</p>
                <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                  {user?.role || 'user'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                <CardTitle className="text-base sm:text-lg">Subscription</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">Manage your subscription and billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={hasActiveSubscription ? 'default' : 'outline'}
                      data-testid="badge-subscription-status"
                      className="text-xs"
                    >
                      {subscriptionStatus}
                    </Badge>
                  </div>
                </div>
                {subLoading && <Skeleton className="h-6 w-20" />}
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                {hasActiveSubscription ? (
                  <Button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="w-full sm:w-auto"
                    data-testid="button-manage-billing"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {portalMutation.isPending ? "Opening..." : "Manage Billing"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Upgrade to Pro to unlock unlimited workspaces, team collaboration, and more.
                    </p>
                    <Button asChild className="w-full sm:w-auto" data-testid="button-upgrade">
                      <Link href="/pricing">Upgrade to Pro</Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <SidebarProvider>
      <SettingsPageContent />
    </SidebarProvider>
  );
}
