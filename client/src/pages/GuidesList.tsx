import { useEffect, useRef, useState } from "react";
import { useWorkspaces, useEnsureDefaultWorkspace } from "@/hooks/use-workspaces";
import { useGuides, useCreateGuide } from "@/hooks/use-guides";
import { useCollections } from "@/hooks/use-collections";
import { Sidebar, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, LayoutGrid, List as ListIcon, FolderOpen } from "lucide-react";
import { Link } from "wouter";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function GuidesList() {
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { mutate: ensureDefaultWorkspace, isPending: isEnsuring } = useEnsureDefaultWorkspace();
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
  const { data: collections } = useCollections(workspaceId);
  const { mutate: createGuide, isPending: isCreating } = useCreateGuide();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");

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

  const filteredGuides = guides?.data?.filter(g => {
    const matchesSearch = g.title.toLowerCase().includes(search.toLowerCase());
    const matchesCollection = collectionFilter === "all" 
      || (collectionFilter === "none" && !g.collectionId)
      || (g.collectionId?.toString() === collectionFilter);
    return matchesSearch && matchesCollection;
  });

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <MobileMenuTrigger />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">My Guides</h1>
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage and organize your workflows.</p>
                </div>
              </div>
              <Button 
                onClick={handleCreateGuide} 
                disabled={isCreating}
                className="rounded-full px-4 sm:px-6 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20"
              >
                <Plus className="mr-2 h-4 w-4" /> New Guide
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="relative flex-1 max-w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search flows..." 
                className="pl-9 bg-card border-border rounded-xl" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-guides"
              />
            </div>
            
            {collections && collections.length > 0 && (
              <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                <SelectTrigger className="w-[180px] bg-card border-border rounded-xl" data-testid="select-collection-filter">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Collections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collections</SelectItem>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id.toString()}>
                      <span className="flex items-center gap-2">
                        {collection.color && (
                          <span 
                            className="h-2 w-2 rounded-full shrink-0" 
                            style={{ backgroundColor: collection.color }}
                          />
                        )}
                        {collection.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex bg-muted p-1 rounded-lg self-start">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid="button-view-grid"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid="button-view-list"
                aria-label="List view"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grid/List View */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-48 sm:h-64 bg-muted/30 rounded-xl sm:rounded-2xl animate-pulse" />)}
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
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" 
              : "space-y-3 sm:space-y-4"
            }>
              {filteredGuides?.map((guide) => (
                <Link key={guide.id} href={`/guides/${guide.id}/edit`}>
                  <div className={cn(
                    "group bg-card border border-border hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5 transition-all cursor-pointer overflow-hidden",
                    viewMode === 'grid' 
                      ? "rounded-xl sm:rounded-2xl flex flex-col h-full" 
                      : "rounded-xl p-3 sm:p-4 flex items-center gap-4 sm:gap-6"
                  )}>
                    {/* Thumbnail */}
                    <div className={viewMode === 'grid' 
                      ? "aspect-video bg-muted relative overflow-hidden" 
                      : "h-12 w-16 sm:h-16 sm:w-24 bg-muted rounded-lg shrink-0 relative overflow-hidden"
                    }>
                      {guide.coverImageUrl ? (
                        <img src={guide.coverImageUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900 flex items-center justify-center text-brand-300">
                          <LayoutGrid className="h-6 w-6 sm:h-8 sm:w-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    </div>

                    {/* Content */}
                    <div className={viewMode === 'grid' 
                      ? "p-4 sm:p-5 flex-1 flex flex-col" 
                      : "flex-1 min-w-0"
                    }>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-base sm:text-lg font-display truncate group-hover:text-primary transition-colors">{guide.title}</h3>
                      </div>
                      <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2 mb-3 sm:mb-4 flex-1">
                        {guide.description || "No description provided."}
                      </p>
                      
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-auto pt-3 sm:pt-4 border-t border-border/50">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${guide.status === 'published' ? 'bg-green-500' : 'bg-orange-400'}`} />
                          <span className="capitalize">{guide.status}</span>
                        </span>
                        <span className="hidden sm:inline">{formatDistanceToNow(new Date(guide.updatedAt))} ago</span>
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
