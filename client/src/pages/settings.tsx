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

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: subscriptionData, isLoading: subLoading } = useQuery<{
    subscription: any;
    status: string;
  }>({
    queryKey: ['/api/subscription'],
    enabled: !!user,
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
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const subscriptionStatus = subscriptionData?.status || 'inactive';
  const hasActiveSubscription = subscriptionStatus === 'active';

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
            <p className="text-muted-foreground">Manage your account and subscription</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium" data-testid="text-user-name">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium" data-testid="text-user-email">
                  {user?.email}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                {user?.role || 'user'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>Subscription</CardTitle>
            </div>
            <CardDescription>Manage your subscription and billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={hasActiveSubscription ? 'default' : 'outline'}
                    data-testid="badge-subscription-status"
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
                  data-testid="button-manage-billing"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {portalMutation.isPending ? 'Opening...' : 'Manage Billing'}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You don't have an active subscription. Upgrade to unlock premium features.
                  </p>
                  <Button asChild data-testid="button-view-plans">
                    <a href="/pricing">View Plans</a>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Access</CardTitle>
              <CardDescription>You have administrator privileges</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" data-testid="button-admin-dashboard">
                <a href="/admin">Open Admin Dashboard</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
