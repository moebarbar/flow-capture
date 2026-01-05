import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Volume2, Play, Pause, Loader2, Mic, RefreshCw, Square } from "lucide-react";

interface Voice {
  id: string;
  name: string;
  description: string;
}

interface StepVoiceover {
  id: number;
  stepId: number;
  audioUrl: string;
  voice: string;
  locale: string;
  status: string;
  duration?: number;
}

interface Step {
  id: number;
  title: string | null;
  description: string | null;
  order: number;
}

interface VoiceoverPanelProps {
  guideId: number;
  steps: Step[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceoverPanel({ guideId, steps, open, onOpenChange }: VoiceoverPanelProps) {
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [locale, setLocale] = useState("en");
  const [customText, setCustomText] = useState<Record<number, string>>({});
  const [playingStepId, setPlayingStepId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const { data: voices } = useQuery<Voice[]>({
    queryKey: ['/api/voiceover/voices'],
  });

  const { data: voiceovers, refetch: refetchVoiceovers } = useQuery<StepVoiceover[]>({
    queryKey: ['/api/guides', guideId, 'voiceovers', locale],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/voiceovers?locale=${locale}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && guideId > 0,
  });

  const generateStepVoiceover = useMutation({
    mutationFn: async ({ stepId, text }: { stepId: number; text?: string }) => {
      const res = await apiRequest('POST', `/api/steps/${stepId}/voiceover`, {
        voice: selectedVoice,
        locale,
        text,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchVoiceovers();
      toast({ title: "Voice-over generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate voice-over", variant: "destructive" });
    },
  });

  const generateAllVoiceovers = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/voiceovers`, {
        voice: selectedVoice,
        locale,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchVoiceovers();
      toast({ title: "All voice-overs generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate voice-overs", variant: "destructive" });
    },
  });

  const getVoiceoverForStep = (stepId: number) => {
    return voiceovers?.find(v => v.stepId === stepId && v.status === 'completed');
  };

  const handlePlay = (stepId: number, audioUrl: string) => {
    if (playingStepId === stepId && audioRef.current) {
      audioRef.current.pause();
      setPlayingStepId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlayingStepId(stepId);
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingStepId(null);
  };

  const getStepText = (step: Step) => {
    return customText[step.id] || step.description || step.title || `Step ${step.order + 1}`;
  };

  const pendingStepId = generateStepVoiceover.isPending ? 
    (generateStepVoiceover.variables as any)?.stepId : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Voice-over Narration
          </DialogTitle>
          <DialogDescription>
            Generate AI voice narration for each step of your guide. Voice-overs are generated on-demand.
          </DialogDescription>
        </DialogHeader>

        <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

        <div className="flex gap-4 py-4">
          <div className="flex-1">
            <Label className="text-sm">Voice</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger data-testid="select-voice">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voices?.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                    <span className="text-xs text-muted-foreground ml-2">{voice.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Label className="text-sm">Language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger data-testid="select-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => generateAllVoiceovers.mutate()}
              disabled={generateAllVoiceovers.isPending || steps.length === 0}
              data-testid="button-generate-all-voiceovers"
            >
              {generateAllVoiceovers.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Generate All
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {steps.map((step) => {
            const voiceover = getVoiceoverForStep(step.id);
            const isPlaying = playingStepId === step.id;
            const isGenerating = pendingStepId === step.id;

            return (
              <div 
                key={step.id} 
                className="p-4 border rounded-lg space-y-3"
                data-testid={`voiceover-step-${step.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      Step {step.order + 1}: {step.title || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {getStepText(step)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {voiceover ? (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handlePlay(step.id, voiceover.audioUrl)}
                          data-testid={`button-play-step-${step.id}`}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => generateStepVoiceover.mutate({ 
                            stepId: step.id, 
                            text: customText[step.id] 
                          })}
                          disabled={isGenerating}
                          data-testid={`button-regenerate-step-${step.id}`}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => generateStepVoiceover.mutate({ 
                          stepId: step.id, 
                          text: customText[step.id] 
                        })}
                        disabled={isGenerating}
                        data-testid={`button-generate-step-${step.id}`}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 mr-2" />
                            Generate
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <Textarea
                  placeholder="Custom narration text (optional - uses step description by default)"
                  value={customText[step.id] || ''}
                  onChange={(e) => setCustomText(prev => ({ ...prev, [step.id]: e.target.value }))}
                  className="text-xs h-16 resize-none"
                  data-testid={`textarea-custom-text-${step.id}`}
                />

                {voiceover && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 bg-muted rounded">{voiceover.voice}</span>
                    {voiceover.duration && (
                      <span>{Math.round(voiceover.duration)}s</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {steps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Add steps to your guide to generate voice-over narration.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
