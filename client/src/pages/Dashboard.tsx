import { useEffect, useRef, useState } from "react";
import { useWorkspaces, useEnsureDefaultWorkspace } from "@/hooks/use-workspaces";
import { useGuides, useCreateGuide } from "@/hooks/use-guides";
import { useExtensionDetection } from "@/hooks/use-extension-detection";
import { Sidebar, useSidebarState, MobileMenuTrigger, SidebarProvider } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { FlowLauncherModal } from "@/components/FlowLauncherModal";
import { Button } from "@/components/ui/button";
import { Plus, Clock, TrendingUp, BookOpen, MoreVertical, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { EmptyState } from "@/components/EmptyState";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface AnalyticsData {
  totalViews: number;
  totalGuides: number;
  viewsTrend: number;
  guidesTrend: number;
  draftsTrend: number;
}

function DashboardContent() {
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { mutate: ensureDefaultWorkspace, isPending: isEnsuring } = useEnsureDefaultWorkspace();
  const { isExtensionInstalled, permissionStatus, requestPermissions } = useExtensionDetection();
  const [showLauncherModal, setShowLauncherModal] = useState(false);
  const ensuredRef = useRef(false);
  const { isCollapsed } = useSidebarState();
  
  useEffect(() => {
    if (!workspacesLoading && workspaces && workspaces.length === 0 && !ensuredRef.current && !isEnsuring) {
      ensuredRef.current = true;
      ensureDefaultWorkspace();
    }
  }, [workspaces, workspacesLoading, isEnsuring, ensureDefaultWorkspace]);

  const workspaceId = workspaces?.[0]?.id;
  const { data: guides, isLoading } = useGuides({ workspaceId });
  const { mutate: createGuide, isPending: isCreating } = useCreateGuide();
  
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?workspaceId=${workspaceId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!workspaceId,
    staleTime: 60000,
  });

  const handleNewFlow = () => {
    setShowLauncherModal(true);
  };

  const handleStartCapture = async () => {
    if (!workspaceId) return;
    
    if (permissionStatus !== 'granted') {
      const granted = await requestPermissions();
      if (!granted) return;
    }
    
    createGuide(
      { 
        workspaceId,
        title: "Untitled Flow",
        status: "draft",
        createdById: "current-user"
      },
      {
        onSuccess: (newGuide) => {
          setShowLauncherModal(false);
          window.location.href = `/guides/${newGuide.id}/edit?autoCapture=true`;
        }
      }
    );
  };

  const handleUploadScreenshots = () => {
    if (!workspaceId) return;
    
    createGuide(
      { 
        workspaceId,
        title: "Untitled Flow",
        status: "draft",
        createdById: "current-user"
      },
      {
        onSuccess: (newGuide) => {
          setShowLauncherModal(false);
          window.location.href = `/guides/${newGuide.id}/edit?mode=upload`;
        }
      }
    );
  };

  const recentGuides = guides?.data?.slice(0, 4);
  const totalViews = guides?.data?.reduce((acc, g) => acc + (g.viewCount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <MobileMenuTrigger />
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">Overview of your documentation activity</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
              <NotificationBell />
              {isExtensionInstalled !== null && !isExtensionInstalled && (
                <Button 
                  variant="outline"
                  className="rounded-full px-3 sm:px-5 text-xs sm:text-sm hidden md:inline-flex"
                  asChild
                >
                  <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" data-testid="button-dashboard-get-extension">
                    <SiGooglechrome className="mr-2 h-4 w-4" />
                    <span className="hidden lg:inline">Get the Extension, it's free</span>
                    <span className="lg:hidden">Extension</span>
                  </a>
                </Button>
              )}
              <Button 
                onClick={handleNewFlow} 
                className="rounded-full px-4 sm:px-6 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20 flex-1 sm:flex-none"
                data-testid="button-dashboard-new-guide"
              >
                <Plus className="mr-2 h-4 w-4" /> New Flow
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {[
              { label: "Total Flows", value: guides?.total || 0, icon: BookOpen, color: "text-blue-500 bg-blue-50 dark:bg-blue-950", trend: analytics?.guidesTrend },
              { label: "Total Views", value: totalViews, icon: TrendingUp, color: "text-green-500 bg-green-50 dark:bg-green-950", trend: analytics?.viewsTrend },
              { label: "Drafts", value: guides?.data?.filter(g => g.status === 'draft').length || 0, icon: Clock, color: "text-orange-500 bg-orange-50 dark:bg-orange-950", trend: analytics?.draftsTrend },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border shadow-sm"
                data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                  <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${stat.color}`}>
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1",
                    (stat.trend ?? 0) > 0 ? "text-green-600 bg-green-50 dark:bg-green-950" : 
                    (stat.trend ?? 0) < 0 ? "text-red-600 bg-red-50 dark:bg-red-950" :
                    "text-muted-foreground bg-muted"
                  )}>
                    {(stat.trend ?? 0) > 0 ? <ArrowUpRight className="h-3 w-3" /> : (stat.trend ?? 0) < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                    {(stat.trend ?? 0) > 0 ? '+' : ''}{stat.trend ?? 0}% this week
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display">{stat.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Recent Guides Section */}
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold font-display mb-4">Recent Flows</h2>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 sm:h-20 bg-muted/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !recentGuides || recentGuides.length === 0 ? (
              <EmptyState 
                icon={BookOpen}
                title="No flows yet"
                description="Create your first flow to start documenting your workflows."
                actionLabel="Create Flow"
                onAction={handleNewFlow}
              />
            ) : (
              <div className="bg-card border border-border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 divide-y divide-border">
                  {recentGuides?.map((guide) => (
                    <div key={guide.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold shrink-0 text-sm sm:text-base">
                          {guide.title[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/guides/${guide.id}/edit`}>
                            <h3 className="font-medium text-foreground hover:text-primary cursor-pointer transition-colors truncate text-sm sm:text-base">
                              {guide.title}
                            </h3>
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            <span className={`capitalize ${guide.status === 'published' ? 'text-green-600' : 'text-orange-500'}`}>
                              {guide.status}
                            </span>
                            <span className="hidden sm:inline">Edited {formatDistanceToNow(new Date(guide.updatedAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                          {guide.viewCount} views
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <FlowLauncherModal
        open={showLauncherModal}
        onOpenChange={setShowLauncherModal}
        isExtensionInstalled={isExtensionInstalled}
        permissionStatus={permissionStatus}
        onStartCapture={handleStartCapture}
        onUploadScreenshots={handleUploadScreenshots}
        isCreating={isCreating}
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
}
