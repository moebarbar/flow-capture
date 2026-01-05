import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Languages, Check, AlertCircle, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupportedLanguage {
  code: string;
  name: string;
}

interface GuideTranslation {
  id: number;
  guideId: number;
  locale: string;
  title: string;
  description: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  translatedAt: string | null;
}

interface TranslationDialogProps {
  guideId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TranslationDialog({ guideId, open, onOpenChange }: TranslationDialogProps) {
  const [selectedLocales, setSelectedLocales] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ['/api/translations/languages'],
    enabled: open,
  });

  const { data: existingTranslations = [], refetch: refetchTranslations } = useQuery<GuideTranslation[]>({
    queryKey: ['/api/guides', guideId, 'translations'],
    enabled: open && guideId > 0,
  });

  const translateMutation = useMutation({
    mutationFn: async (locales: string[]) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/translate`, { locales });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Translation started", description: "Your guide is being translated to the selected languages." });
      refetchTranslations();
      setSelectedLocales([]);
    },
    onError: () => {
      toast({ title: "Translation failed", variant: "destructive" });
    },
  });

  const toggleLocale = (code: string) => {
    setSelectedLocales(prev => 
      prev.includes(code) 
        ? prev.filter(l => l !== code) 
        : [...prev, code]
    );
  };

  const getTranslationStatus = (locale: string) => {
    const translation = existingTranslations.find(t => t.locale === locale);
    return translation?.status || null;
  };

  const handleTranslate = () => {
    if (selectedLocales.length === 0) {
      toast({ title: "Select at least one language", variant: "destructive" });
      return;
    }
    translateMutation.mutate(selectedLocales);
  };

  const availableLanguages = languages.filter(l => l.code !== 'en');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-brand-600" />
            Translate Guide
          </DialogTitle>
          <DialogDescription>
            Select languages to translate your guide. AI will automatically translate titles and descriptions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {availableLanguages.map((lang) => {
              const status = getTranslationStatus(lang.code);
              const isSelected = selectedLocales.includes(lang.code);
              
              return (
                <div 
                  key={lang.code}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleLocale(lang.code)}
                  data-testid={`checkbox-lang-${lang.code}`}
                >
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleLocale(lang.code)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{lang.name}</div>
                    <div className="text-xs text-muted-foreground uppercase">{lang.code}</div>
                  </div>
                  {status && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        ''
                      }`}
                    >
                      {status === 'completed' && <Check className="h-3 w-3 mr-1" />}
                      {status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {status}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {existingTranslations.length > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {existingTranslations.filter(t => t.status === 'completed').length} language(s) already translated
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleTranslate}
            disabled={selectedLocales.length === 0 || translateMutation.isPending}
            className="bg-brand-600 hover:bg-brand-700"
            data-testid="button-start-translation"
          >
            {translateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="h-4 w-4 mr-2" />
                Translate ({selectedLocales.length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
