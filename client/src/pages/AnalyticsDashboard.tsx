import { Sidebar, SidebarProvider, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { BarChart3, Eye, Users, Clock, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalViews: number;
  totalGuides: number;
  avgCompletionRate: number;
  avgTimeSpent: number;
  viewsTrend: number;
  guidesThisWeek: number;
  guidesTrend: number;
  draftsTrend: number;
  topGuides: Array<{
    id: number;
    title: string;
    views: number;
    completionRate: number;
  }>;
  recentActivity: Array<{
    guideId: number;
    guideTitle: string;
    action: string;
    timestamp: string;
  }>;
}

function AnalyticsDashboardContent() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.[0];
  const { isCollapsed } = useSidebarState();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', activeWorkspace?.id],
    enabled: !!activeWorkspace?.id,
    staleTime: 60000,
  });

  const stats = [
    {
      title: "Total Views",
      value: analytics?.totalViews ?? 0,
      icon: Eye,
      trend: analytics?.viewsTrend ?? 0,
      description: "All time flow views",
    },
    {
      title: "Active Flows",
      value: analytics?.totalGuides ?? 0,
      icon: BarChart3,
      description: "Published flows",
    },
    {
      title: "Avg. Completion",
      value: `${analytics?.avgCompletionRate ?? 0}%`,
      icon: TrendingUp,
      description: "Steps completed",
    },
    {
      title: "Avg. Time Spent",
      value: `${analytics?.avgTimeSpent ?? 0}s`,
      icon: Clock,
      description: "Per flow session",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <MobileMenuTrigger />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-analytics-title">Analytics</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Track how your flows are performing
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
            {stats.map((stat, i) => (
              <Card key={i} data-testid={`card-stat-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
                  ) : (
                    <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                      <span className="text-lg sm:text-2xl font-bold" data-testid={`text-stat-value-${i}`}>
                        {stat.value}
                      </span>
                      {stat.trend !== undefined && stat.trend !== 0 && (
                        <span className={`flex items-center text-xs font-medium ${stat.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(stat.trend)}%
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card data-testid="card-top-guides">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  Top Performing Flows
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Your most viewed flows this month</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : analytics?.topGuides?.length ? (
                  <div className="space-y-3 sm:space-y-4">
                    {analytics.topGuides.map((guide, i) => (
                      <div key={guide.id} className="flex items-center justify-between gap-2 sm:gap-4" data-testid={`row-top-guide-${i}`}>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-medium text-muted-foreground w-5 sm:w-6 shrink-0">#{i + 1}</span>
                          <span className="text-xs sm:text-sm font-medium truncate">{guide.title}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <span className="text-xs sm:text-sm text-muted-foreground">{guide.views} views</span>
                          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{guide.completionRate}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">No flow data yet</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-recent-activity">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Latest viewer interactions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : analytics?.recentActivity?.length ? (
                  <div className="space-y-3 sm:space-y-4">
                    {analytics.recentActivity.map((activity, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4" data-testid={`row-activity-${i}`}>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-medium truncate block">{activity.guideTitle}</span>
                          <span className="text-xs text-muted-foreground">{activity.action}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{new Date(activity.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6 sm:py-8">No activity yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AnalyticsDashboard() {
  return (
    <SidebarProvider>
      <AnalyticsDashboardContent />
    </SidebarProvider>
  );
}
