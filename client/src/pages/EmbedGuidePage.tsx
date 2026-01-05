import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type EmbedGuideContent = {
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
};

export default function EmbedGuidePage() {
  const [, params] = useRoute("/embed/:token");
  const token = params?.token || "";
  const [currentStep, setCurrentStep] = useState(0);

  const { data, isLoading, isError, error } = useQuery<EmbedGuideContent>({
    queryKey: ['/api/embed', token],
    queryFn: async () => {
      const res = await fetch(`/api/embed/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to load guide");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <p className="text-sm text-muted-foreground">
            {(error as Error)?.message || "This guide is not available"}
          </p>
        </div>
      </div>
    );
  }

  const sortedSteps = [...data.steps].sort((a, b) => a.order - b.order);
  const currentStepData = sortedSteps[currentStep];
  const totalSteps = sortedSteps.length;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold truncate" data-testid="text-embed-title">
            {data.guide.title}
          </h1>
          <span className="text-xs text-muted-foreground shrink-0">
            {currentStep + 1}/{totalSteps}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {currentStepData && (
          <div className="h-full flex flex-col">
            {currentStepData.imageUrl && (
              <div className="flex-1 min-h-0 bg-muted/30 flex items-center justify-center p-4">
                <img
                  src={currentStepData.imageUrl}
                  alt={currentStepData.title || "Step screenshot"}
                  className="max-w-full max-h-full object-contain rounded-md"
                  data-testid={`img-embed-step-${currentStepData.id}`}
                />
              </div>
            )}
            <div className="shrink-0 p-4 bg-card border-t border-border">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {currentStep + 1}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium" data-testid={`text-embed-step-title-${currentStepData.id}`}>
                    {currentStepData.title || `Step ${currentStep + 1}`}
                  </h2>
                  {currentStepData.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {currentStepData.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="shrink-0 px-4 py-3 border-t border-border bg-card flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          data-testid="button-embed-prev"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex gap-1">
          {sortedSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                currentStep === index
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30"
              )}
              data-testid={`button-embed-dot-${index}`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1))}
          disabled={currentStep === totalSteps - 1}
          data-testid="button-embed-next"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </footer>
    </div>
  );
}
