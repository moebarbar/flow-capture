import { Sidebar, useSidebarState } from "@/components/Sidebar";
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

export default function AnalyticsDashboard() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.[0];
  const { isCollapsed } = useSidebarState();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', activeWorkspace?.id],
    enabled: !!activeWorkspace?.id,
  });

  const stats = [
    {
      title: "Total Views",
      value: analytics?.totalViews ?? 0,
      icon: Eye,
      trend: analytics?.viewsTrend ?? 0,
      description: "All time guide views",
    },
    {
      title: "Active Guides",
      value: analytics?.totalGuides ?? 0,
      icon: BarChart3,
      description: "Published guides",
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
      description: "Per guide session",
    },
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
            <h1 className="text-3xl font-bold" data-testid="text-analytics-title">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track how your guides are performing
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {stats.map((stat, i) => (
              <Card key={i} data-testid={`card-stat-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold" data-testid={`text-stat-value-${i}`}>
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
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card data-testid="card-top-guides">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Performing Guides
                </CardTitle>
                <CardDescription>Your most viewed guides this month</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : analytics?.topGuides && analytics.topGuides.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topGuides.map((guide, i) => (
                      <div 
                        key={guide.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        data-testid={`row-top-guide-${guide.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            #{i + 1}
                          </span>
                          <div>
                            <p className="font-medium">{guide.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {guide.completionRate}% completion rate
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          <Eye className="h-3 w-3 mr-1" />
                          {guide.views}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No guide views yet</p>
                    <p className="text-sm">Create and share guides to see analytics</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest viewer interactions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.recentActivity.map((activity, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        data-testid={`row-activity-${i}`}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Eye className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{activity.guideTitle}</p>
                          <p className="text-sm text-muted-foreground">{activity.action}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No recent activity</p>
                    <p className="text-sm">Share your guides to see viewer activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
