import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function CheckoutSuccessPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation('/dashboard');
    }, 5000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md text-center">
          <CardHeader className="space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto"
            >
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl" data-testid="text-checkout-success">
              Payment Successful!
            </CardTitle>
            <CardDescription className="text-base">
              Thank you for subscribing. Your account has been upgraded and you now have access to all premium features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You will be redirected to your dashboard in a few seconds...
            </p>
            <Button onClick={() => setLocation('/dashboard')} className="w-full" data-testid="button-go-dashboard">
              Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
