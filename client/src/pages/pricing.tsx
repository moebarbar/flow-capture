import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Zap, Crown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: Record<string, string> | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string> | null;
  prices: Price[];
}

const tierIcons: Record<string, typeof Zap> = {
  free: Zap,
  pro: Crown,
};

export default function PricingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/products'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (product: Product) => {
      const isPro = product.metadata?.tier === 'pro';
      if (isPro) {
        // Pro uses the seat-aware checkout (base price + optional seats)
        const res = await apiRequest('POST', '/api/billing/checkout/pro', { additionalSeats: 0 });
        return res.json();
      }
      const price = product.prices.find(p => p.recurring?.interval === 'month') || product.prices[0];
      if (!price) throw new Error('No price available for this plan');
      const res = await apiRequest('POST', '/api/checkout', { priceId: price.id });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to start checkout", variant: "destructive" });
    },
  });

  const formatPrice = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const parseFeatures = (metadata: Record<string, string> | null): string[] => {
    try {
      return metadata?.features ? JSON.parse(metadata.features) : [];
    } catch {
      return [];
    }
  };

  const sortedProducts = (productsData?.data || [])
    .filter((p) => p.metadata?.hidden !== 'true')
    .sort((a, b) => {
      const tierOrder: Record<string, number> = { free: 0, pro: 1 };
      const tierA = a.metadata?.tier || 'free';
      const tierB = b.metadata?.tier || 'free';
      return (tierOrder[tierA] ?? 99) - (tierOrder[tierB] ?? 99);
    });

  if (productsLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => <Skeleton key={i} className="h-96 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold" data-testid="text-pricing-title">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free and upgrade as your documentation needs grow
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {sortedProducts.map((product) => {
            const tier = product.metadata?.tier || 'free';
            const isPopular = product.metadata?.popular === 'true';
            const isPro = tier === 'pro';
            const price = product.prices.find(p => p.recurring?.interval === 'month') || product.prices[0];
            const features = parseFeatures(product.metadata);
            const Icon = tierIcons[tier] || Zap;

            return (
              <Card
                key={product.id}
                className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg' : ''}`}
                data-testid={`card-plan-${tier}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-muted">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{product.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold" data-testid={`text-price-${tier}`}>
                      {price ? formatPrice(price.unit_amount, price.currency) : '$0'}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                    {isPro && (
                      <div className="text-sm text-muted-foreground mt-1">
                        + $7/month per additional user
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {tier === 'free' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!!user}
                      asChild={!user}
                      data-testid="button-get-started-free"
                    >
                      {user ? <span>Current Plan</span> : <a href="/auth">Sign Up Free</a>}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                      disabled={!user || checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate(product)}
                      data-testid={`button-subscribe-${tier}`}
                    >
                      {checkoutMutation.isPending ? 'Processing...' : `Subscribe to ${product.name}`}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {!user && (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Sign in to subscribe to a plan
            </p>
            <Button asChild>
              <a href="/auth" data-testid="link-signin-pricing">Sign In</a>
            </Button>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>Cancel anytime from your billing settings.</p>
        </div>
      </div>
    </div>
  );
}
