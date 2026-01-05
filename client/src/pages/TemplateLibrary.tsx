import { Sidebar, useSidebarState } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useLocation } from "wouter";
import { 
  LayoutTemplate, BookOpen, Users, Headphones, GraduationCap, 
  Briefcase, Code, Megaphone, Plus, Eye, Loader2
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Template {
  id: number;
  title: string;
  description: string | null;
  category: string;
  coverImageUrl: string | null;
  usageCount: number;
  isPublic: boolean;
}

const categoryIcons: Record<string, typeof BookOpen> = {
  onboarding: GraduationCap,
  training: GraduationCap,
  sales: Briefcase,
  support: Headphones,
  hr: Users,
  it: Code,
  marketing: Megaphone,
  custom: LayoutTemplate,
};

const categoryColors: Record<string, string> = {
  onboarding: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  training: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  sales: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  support: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  hr: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  it: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  marketing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function TemplateLibrary() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.[0];
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isCollapsed } = useSidebarState();

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['/api/templates'],
  });

  const createFromTemplate = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest('POST', `/api/templates/${templateId}/use`, {
        workspaceId: activeWorkspace?.id,
      });
      return response.json();
    },
    onSuccess: (guide) => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides'] });
      toast({
        title: "Guide created",
        description: "Your new guide has been created from the template",
      });
      navigate(`/guides/${guide.id}/edit`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create guide from template",
        variant: "destructive",
      });
    },
  });

  const categories = [
    { id: "all", label: "All Templates" },
    { id: "onboarding", label: "Onboarding" },
    { id: "training", label: "Training" },
    { id: "sales", label: "Sales" },
    { id: "support", label: "Support" },
    { id: "hr", label: "HR" },
    { id: "it", label: "IT" },
    { id: "marketing", label: "Marketing" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-8 transition-all duration-200",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold" data-testid="text-templates-title">Template Library</h1>
            <p className="text-muted-foreground mt-1">
              Start with a pre-built template to create guides faster
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
              <Badge 
                key={cat.id} 
                variant="outline" 
                className="cursor-pointer hover-elevate px-3 py-1"
                data-testid={`filter-category-${cat.id}`}
              >
                {cat.label}
              </Badge>
            ))}
          </div>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-32 bg-muted animate-pulse" />
                  <CardContent className="p-4">
                    <div className="h-5 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const Icon = categoryIcons[template.category] || LayoutTemplate;
                const colorClass = categoryColors[template.category] || categoryColors.custom;
                
                return (
                  <Card 
                    key={template.id} 
                    className="overflow-hidden group hover:shadow-lg transition-shadow"
                    data-testid={`card-template-${template.id}`}
                  >
                    <div className={`h-32 flex items-center justify-center ${colorClass.split(' ')[0]}`}>
                      <Icon className={`h-16 w-16 ${colorClass.split(' ').slice(1).join(' ')} opacity-50`} />
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{template.title}</CardTitle>
                        <Badge variant="secondary" className={colorClass}>
                          {template.category}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {template.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {template.usageCount} uses
                        </span>
                        <Button 
                          size="sm"
                          onClick={() => createFromTemplate.mutate(template.id)}
                          disabled={createFromTemplate.isPending || !activeWorkspace}
                          data-testid={`button-use-template-${template.id}`}
                        >
                          {createFromTemplate.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Use Template
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <LayoutTemplate className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No templates available yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Templates will appear here once they're created. Start by creating a guide and saving it as a template.
                </p>
                <Button onClick={() => navigate("/guides")} data-testid="button-go-to-guides">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Go to My Guides
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
