import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { 
  ChevronLeft, ChevronRight, Play, RotateCcw, X, 
  Check, MousePointer, Keyboard, Navigation 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  order: number;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  actionType: string;
  selector: string | null;
}

interface Guide {
  id: number;
  title: string;
  description: string | null;
}

const actionIcons: Record<string, typeof MousePointer> = {
  click: MousePointer,
  input: Keyboard,
  navigation: Navigation,
  scroll: Navigation,
  wait: Play,
  custom: Play,
};

export default function InteractiveDemo() {
  const [, params] = useRoute("/demo/:token");
  const shareToken = params?.token;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const { data: guideData, isLoading, error } = useQuery<{ guide: Guide; steps: Step[] }>({
    queryKey: ['/api/share', shareToken, 'demo'],
    queryFn: async () => {
      const res = await fetch(`/api/share/${shareToken}/demo`);
      if (!res.ok) throw new Error('Failed to load demo');
      return res.json();
    },
    enabled: !!shareToken,
  });

  const guide = guideData?.guide;
  const steps = guideData?.steps?.sort((a, b) => a.order - b.order) || [];
  const currentStep = steps[currentStepIndex];
  const progress = steps.length > 0 ? ((completedSteps.size) / steps.length) * 100 : 0;

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  }, [steps.length]);

  const markStepComplete = useCallback(() => {
    if (currentStep) {
      setCompletedSteps(prev => new Set([...prev, currentStep.id]));
    }
  }, [currentStep]);

  const nextStep = useCallback(() => {
    markStepComplete();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentStepIndex, steps.length, markStepComplete]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const restart = useCallback(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setShowIntro(true);
    setIsPlaying(false);
  }, []);

  const startDemo = () => {
    setShowIntro(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (isPlaying && currentStep) {
      const timer = setTimeout(() => {
        nextStep();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentStep, nextStep]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        setIsPlaying(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextStep, prevStep]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading interactive demo...</p>
        </div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <X className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Demo Not Found</h2>
          <p className="text-muted-foreground">
            This interactive demo is not available or has been disabled.
          </p>
        </Card>
      </div>
    );
  }

  if (showIntro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8 text-center max-w-lg">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Play className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-3" data-testid="text-demo-title">{guide.title}</h1>
            {guide.description && (
              <p className="text-muted-foreground mb-6">{guide.description}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
              <Badge variant="secondary">{steps.length} steps</Badge>
              <span>Estimated time: {Math.ceil(steps.length * 0.5)} min</span>
            </div>
            <Button size="lg" onClick={startDemo} data-testid="button-start-demo">
              <Play className="h-5 w-5 mr-2" />
              Start Interactive Demo
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Use arrow keys or click to navigate
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  const ActionIcon = actionIcons[currentStep?.actionType || 'click'] || MousePointer;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-semibold truncate text-sm sm:text-base">{guide.title}</h1>
            <Badge variant="outline" className="shrink-0">
              {currentStepIndex + 1} / {steps.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={restart}
              title="Restart"
              data-testid="button-restart-demo"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pause" : "Auto-play"}
              data-testid="button-toggle-autoplay"
            >
              {isPlaying ? <X className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-1" />
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl"
            >
              {currentStep?.imageUrl && !currentStep.imageUrl.includes('placehold') ? (
                <div className="relative rounded-lg overflow-hidden border shadow-lg bg-muted">
                  <img
                    src={currentStep.imageUrl}
                    alt={currentStep.title || `Step ${currentStep.order}`}
                    className="w-full h-auto"
                    data-testid={`img-step-${currentStep.id}`}
                  />
                  {currentStep.selector && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="h-12 w-12 rounded-full border-4 border-primary bg-primary/20"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                  <ActionIcon className="h-16 w-16 text-muted-foreground/50" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="lg:w-96 border-t lg:border-t-0 lg:border-l p-4 sm:p-6 bg-muted/30">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep?.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  completedSteps.has(currentStep?.id || 0)
                    ? "bg-green-500 text-white"
                    : "bg-primary/10 text-primary"
                )}>
                  {completedSteps.has(currentStep?.id || 0) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-bold">{currentStepIndex + 1}</span>
                  )}
                </div>
                <Badge variant="secondary" className="capitalize">
                  <ActionIcon className="h-3 w-3 mr-1" />
                  {currentStep?.actionType || 'action'}
                </Badge>
              </div>

              <h2 className="text-xl font-bold mb-2" data-testid="text-step-title">
                {currentStep?.title || `Step ${currentStepIndex + 1}`}
              </h2>
              
              {currentStep?.description && (
                <p className="text-muted-foreground mb-6" data-testid="text-step-description">
                  {currentStep.description}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStepIndex === 0}
                  className="flex-1"
                  data-testid="button-prev-step"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1"
                  data-testid="button-next-step"
                >
                  {currentStepIndex === steps.length - 1 ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Complete
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8">
            <h3 className="text-sm font-medium mb-3">All Steps</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                    index === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : completedSteps.has(step.id)
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "hover:bg-muted"
                  )}
                  data-testid={`button-goto-step-${step.id}`}
                >
                  <span className="shrink-0 h-5 w-5 rounded-full border flex items-center justify-center text-xs">
                    {completedSteps.has(step.id) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="truncate">{step.title || `Step ${index + 1}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
