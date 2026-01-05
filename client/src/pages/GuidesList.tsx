import { useEffect, useRef, useState } from "react";
import { useWorkspaces, useEnsureDefaultWorkspace } from "@/hooks/use-workspaces";
import { useGuides, useCreateGuide } from "@/hooks/use-guides";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { Link } from "wouter";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";

export default function GuidesList() {
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { mutate: ensureDefaultWorkspace, isPending: isEnsuring } = useEnsureDefaultWorkspace();
  const ensuredRef = useRef(false);
  
  useEffect(() => {
    if (!workspacesLoading && workspaces && workspaces.length === 0 && !ensuredRef.current && !isEnsuring) {
      ensuredRef.current = true;
      ensureDefaultWorkspace();
    }
  }, [workspaces, workspacesLoading, isEnsuring, ensureDefaultWorkspace]);

  const workspaceId = workspaces?.[0]?.id;
  const { data: guides, isLoading } = useGuides({ workspaceId });
  const { mutate: createGuide, isPending: isCreating } = useCreateGuide();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState("");

  const handleCreateGuide = () => {
    if (!workspaceId) return;
    createGuide(
      { 
        workspaceId,
        title: "Untitled Guide",
        status: "draft",
        createdById: "current-user"
      },
      {
        onSuccess: (newGuide) => {
          window.location.href = `/guides/${newGuide.id}/edit`;
        }
      }
    );
  };

  const filteredGuides = guides?.filter(g => 
    g.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">My Guides</h1>
              <p className="text-muted-foreground mt-1">Manage and organize your workflows.</p>
            </div>
            <Button 
              onClick={handleCreateGuide} 
              disabled={isCreating}
              className="rounded-full px-6 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20"
            >
              <Plus className="mr-2 h-4 w-4" /> New Guide
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search guides..." 
                className="pl-9 bg-card border-border rounded-xl" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex bg-muted p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grid/List View */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-64 bg-muted/30 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredGuides?.length === 0 ? (
            <EmptyState 
              icon={LayoutGrid}
              title="No guides found"
              description={search ? "Try a different search term." : "Create your first guide to get started."}
              actionLabel={search ? undefined : "Create Guide"}
              onAction={search ? undefined : handleCreateGuide}
            />
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {filteredGuides?.map((guide) => (
                <Link key={guide.id} href={`/guides/${guide.id}/edit`}>
                  <div className={`
                    group bg-card border border-border hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5 transition-all cursor-pointer overflow-hidden
                    ${viewMode === 'grid' ? 'rounded-2xl flex flex-col h-full' : 'rounded-xl p-4 flex items-center gap-6'}
                  `}>
                    {/* Thumbnail */}
                    <div className={viewMode === 'grid' ? "aspect-video bg-muted relative overflow-hidden" : "h-16 w-24 bg-muted rounded-lg shrink-0 relative overflow-hidden"}>
                      {guide.coverImageUrl ? (
                        <img src={guide.coverImageUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-brand-300">
                          <LayoutGrid className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    </div>

                    {/* Content */}
                    <div className={viewMode === 'grid' ? "p-5 flex-1 flex flex-col" : "flex-1 min-w-0"}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                         <h3 className="font-bold text-lg font-display truncate group-hover:text-primary transition-colors">{guide.title}</h3>
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">
                        {guide.description || "No description provided."}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${guide.status === 'published' ? 'bg-green-500' : 'bg-orange-400'}`} />
                          <span className="capitalize">{guide.status}</span>
                        </span>
                        <span>{formatDistanceToNow(new Date(guide.updatedAt))} ago</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
