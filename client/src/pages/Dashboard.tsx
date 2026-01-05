import { useWorkspaces } from "@/hooks/use-workspaces";
import { useGuides, useCreateGuide } from "@/hooks/use-guides";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Clock, TrendingUp, BookOpen, MoreVertical } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { EmptyState } from "@/components/EmptyState";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id; // Mock active workspace
  const { data: guides, isLoading } = useGuides({ workspaceId });
  const { mutate: createGuide, isPending: isCreating } = useCreateGuide();

  const handleCreateGuide = () => {
    if (!workspaceId) return;
    createGuide(
      { 
        workspaceId,
        title: "Untitled Guide",
        status: "draft",
        createdById: "current-user" // This would be handled by backend usually
      },
      {
        onSuccess: (newGuide) => {
          // Navigate to editor
          window.location.href = `/guides/${newGuide.id}/edit`;
        }
      }
    );
  };

  const recentGuides = guides?.slice(0, 4);
  const totalViews = guides?.reduce((acc, g) => acc + (g.viewCount || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of your documentation activity</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button 
                variant="outline"
                className="rounded-full px-5"
                asChild
              >
                <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" data-testid="button-dashboard-get-extension">
                  <SiGooglechrome className="mr-2 h-4 w-4" />
                  Get the Extension, it's free
                </a>
              </Button>
              <Button 
                onClick={handleCreateGuide} 
                disabled={isCreating}
                className="rounded-full px-6 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                data-testid="button-dashboard-new-guide"
              >
                {isCreating ? "Creating..." : <><Plus className="mr-2 h-4 w-4" /> New Guide</>}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { label: "Total Guides", value: guides?.length || 0, icon: BookOpen, color: "text-blue-500 bg-blue-50" },
              { label: "Total Views", value: totalViews, icon: TrendingUp, color: "text-green-500 bg-green-50" },
              { label: "Drafts", value: guides?.filter(g => g.status === 'draft').length || 0, icon: Clock, color: "text-orange-500 bg-orange-50" },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-6 rounded-2xl border border-border shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">+12% this week</span>
                </div>
                <div className="text-3xl font-bold font-display">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Recent Guides Section */}
          <div className="mb-6">
            <h2 className="text-xl font-bold font-display mb-4">Recent Guides</h2>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentGuides?.length === 0 ? (
              <EmptyState 
                icon={BookOpen}
                title="No guides yet"
                description="Create your first guide to start documenting your workflows."
                actionLabel="Create Guide"
                onAction={handleCreateGuide}
              />
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-1 divide-y divide-border">
                  {recentGuides?.map((guide) => (
                    <div key={guide.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-bold shrink-0">
                          {guide.title[0]}
                        </div>
                        <div>
                          <Link href={`/guides/${guide.id}/edit`}>
                            <h3 className="font-medium text-foreground hover:text-primary cursor-pointer transition-colors">
                              {guide.title}
                            </h3>
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className={`capitalize ${guide.status === 'published' ? 'text-green-600' : 'text-orange-500'}`}>
                              ● {guide.status}
                            </span>
                            <span>•</span>
                            <span>Edited {formatDistanceToNow(new Date(guide.updatedAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground hidden sm:block">
                          {guide.viewCount} views
                        </div>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
}
