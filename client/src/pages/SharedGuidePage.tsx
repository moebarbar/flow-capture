import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Eye, EyeOff, AlertCircle, FileText, Loader2, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SharedGuideInfo = {
  title: string;
  requiresPassword: boolean;
  guideId?: number;
  availableLanguages?: Array<{ code: string; name: string }>;
};

type SharedGuideContent = {
  guide: {
    id: number;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
  };
  steps: Array<{
    id: number;
    order: number;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    actionType: string;
    metadata: any;
  }>;
  translations?: {
    guide?: {
      title: string;
      description: string | null;
    };
    steps?: Array<{
      stepId: number;
      title: string | null;
      description: string | null;
    }>;
  };
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
};

export default function SharedGuidePage() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token || "";

  const [password, setPassword] = useState("");
  const [verifiedPassword, setVerifiedPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideContent, setGuideContent] = useState<SharedGuideContent | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLocale, setSelectedLocale] = useState<string>("en");

  const { data: shareInfo, isLoading: infoLoading, isError: infoError } = useQuery<SharedGuideInfo>({
    queryKey: ['/api/share', token],
    queryFn: async () => {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) throw new Error("Flow not found");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ password, locale }: { password: string; locale?: string }) => {
      const res = await fetch(`/api/share/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, locale }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Access denied");
      }
      return res.json() as Promise<SharedGuideContent>;
    },
    onSuccess: (data, variables) => {
      setGuideContent(data);
      setError(null);
      if (variables.password) {
        setVerifiedPassword(variables.password);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleLocaleChange = (locale: string) => {
    setSelectedLocale(locale);
    if (guideContent) {
      verifyMutation.mutate({ password: verifiedPassword, locale });
    }
  };

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    verifyMutation.mutate({ password, locale: selectedLocale !== 'en' ? selectedLocale : undefined });
  };

  const handleAccessNoPassword = () => {
    verifyMutation.mutate({ password: "", locale: selectedLocale !== 'en' ? selectedLocale : undefined });
  };

  if (infoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (infoError || !shareInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Flow Not Found</CardTitle>
            <CardDescription>
              This flow may have been removed or the link is invalid.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!guideContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <FileText className="h-12 w-12 mx-auto text-primary mb-4" />
              <CardTitle>{shareInfo.title}</CardTitle>
              <CardDescription>
                {shareInfo.requiresPassword 
                  ? "This flow is password protected. Enter the password to view." 
                  : "Click below to view this flow."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shareInfo.requiresPassword ? (
                <form onSubmit={handleSubmitPassword} className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pl-10 pr-10"
                      autoFocus
                      data-testid="input-share-verify-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!password || verifyMutation.isPending}
                    data-testid="button-verify-password"
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "View Flow"
                    )}
                  </Button>
                </form>
              ) : (
                <Button 
                  onClick={handleAccessNoPassword} 
                  className="w-full"
                  disabled={verifyMutation.isPending}
                  data-testid="button-access-guide"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "View Flow"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const sortedSteps = [...guideContent.steps].sort((a, b) => a.order - b.order);
  const currentStepData = sortedSteps[currentStep];
  
  const displayContent = useMemo(() => {
    const translations = guideContent.translations;
    const guideTitle = translations?.guide?.title || guideContent.guide.title;
    const guideDesc = translations?.guide?.description ?? guideContent.guide.description;
    
    const getStepContent = (step: typeof sortedSteps[0]) => {
      const stepTranslation = translations?.steps?.find(t => t.stepId === step.id);
      return {
        ...step,
        title: stepTranslation?.title || step.title,
        description: stepTranslation?.description ?? step.description,
      };
    };
    
    return {
      guideTitle,
      guideDesc,
      getStepContent,
    };
  }, [guideContent, selectedLocale]);

  const availableLanguages = shareInfo?.availableLanguages || [];
  const hasTranslations = availableLanguages.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate" data-testid="text-guide-title">
              {displayContent.guideTitle}
            </h1>
            {displayContent.guideDesc && (
              <p className="text-sm text-muted-foreground truncate">
                {displayContent.guideDesc}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {hasTranslations && (
              <Select value={selectedLocale} onValueChange={handleLocaleChange}>
                <SelectTrigger className="w-36" data-testid="select-language">
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  {availableLanguages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {sortedSteps.length}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {currentStepData && (() => {
          const translatedStep = displayContent.getStepContent(currentStepData);
          return (
            <motion.div
              key={`${currentStepData.id}-${selectedLocale}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden">
                {currentStepData.imageUrl && (
                  <div className="aspect-video bg-muted relative">
                    <img 
                      src={currentStepData.imageUrl} 
                      alt={translatedStep.title || "Step screenshot"}
                      className="w-full h-full object-contain"
                      data-testid={`img-step-${currentStepData.id}`}
                    />
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                      {currentStep + 1}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold mb-2" data-testid={`text-step-title-${currentStepData.id}`}>
                        {translatedStep.title || `Step ${currentStep + 1}`}
                      </h2>
                      {translatedStep.description && (
                        <p className="text-muted-foreground" data-testid={`text-step-desc-${currentStepData.id}`}>
                          {translatedStep.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        <div className="flex items-center justify-between mt-8 gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            data-testid="button-prev-step"
          >
            Previous
          </Button>

          <div className="flex gap-1 flex-wrap justify-center">
            {sortedSteps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  currentStep === index 
                    ? "w-6 bg-primary" 
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                data-testid={`button-step-dot-${index}`}
              />
            ))}
          </div>

          <Button
            onClick={() => setCurrentStep(Math.min(sortedSteps.length - 1, currentStep + 1))}
            disabled={currentStep === sortedSteps.length - 1}
            data-testid="button-next-step"
          >
            Next
          </Button>
        </div>
      </main>
    </div>
  );
}
