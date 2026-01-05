import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Zap, Crown, Building } from "lucide-react";
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
  team: Building,
};

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/products'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest('POST', '/api/checkout', { priceId });
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

  const getPrice = (product: Product, isYearly: boolean): Price | undefined => {
    const interval = isYearly ? 'year' : 'month';
    return product.prices.find(p => p.recurring?.interval === interval) || product.prices[0];
  };

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

  const sortedProducts = productsData?.data
    ?.slice()
    .sort((a, b) => {
      const tierOrder: Record<string, number> = { free: 0, pro: 1, team: 2 };
      const tierA = a.metadata?.tier || 'free';
      const tierB = b.metadata?.tier || 'free';
      return (tierOrder[tierA] || 99) - (tierOrder[tierB] || 99);
    }) || [];

  if (productsLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold" data-testid="text-pricing-title">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free and upgrade as your documentation needs grow
          </p>
          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="billing-toggle" className="text-sm">Monthly</Label>
            <Switch
              id="billing-toggle"
              checked={yearly}
              onCheckedChange={setYearly}
              data-testid="switch-billing-toggle"
            />
            <Label htmlFor="billing-toggle" className="text-sm">
              Yearly <Badge variant="secondary" className="ml-1">Save 20%</Badge>
            </Label>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {sortedProducts.map((product) => {
            const tier = product.metadata?.tier || 'free';
            const isPopular = product.metadata?.popular === 'true';
            const price = getPrice(product, yearly);
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
                    <span className="text-muted-foreground">
                      /{yearly ? 'year' : 'month'}
                    </span>
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
                      disabled={!user}
                      data-testid="button-get-started-free"
                    >
                      {user ? 'Current Plan' : 'Sign Up Free'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                      disabled={!user || checkoutMutation.isPending}
                      onClick={() => price && checkoutMutation.mutate(price.id)}
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
              <a href="/api/login" data-testid="link-signin-pricing">Sign In</a>
            </Button>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include a 14-day free trial. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}
