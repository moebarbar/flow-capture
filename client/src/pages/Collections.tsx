import { useEffect, useRef, useState } from "react";
import { useWorkspaces, useEnsureDefaultWorkspace } from "@/hooks/use-workspaces";
import { useCollections, useCreateCollection, useDeleteCollection } from "@/hooks/use-collections";
import { Sidebar, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Search, FolderOpen, ChevronRight, MoreHorizontal, 
  Edit2, Trash2, FolderPlus, Palette
} from "lucide-react";
import { Link } from "wouter";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { CollectionWithCount } from "@/hooks/use-collections";

const COLLECTION_COLORS = [
  { name: "Default", value: null },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

const COLLECTION_ICONS = [
  { name: "Folder", value: "folder" },
  { name: "Star", value: "star" },
  { name: "Heart", value: "heart" },
  { name: "Lightning", value: "zap" },
  { name: "Book", value: "book" },
  { name: "Briefcase", value: "briefcase" },
  { name: "Users", value: "users" },
  { name: "Settings", value: "settings" },
];

export default function Collections() {
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { mutate: ensureDefaultWorkspace, isPending: isEnsuring } = useEnsureDefaultWorkspace();
  const ensuredRef = useRef(false);
  const { isCollapsed } = useSidebarState();
  const { toast } = useToast();
  
  useEffect(() => {
    if (!workspacesLoading && workspaces && workspaces.length === 0 && !ensuredRef.current && !isEnsuring) {
      ensuredRef.current = true;
      ensureDefaultWorkspace();
    }
  }, [workspaces, workspacesLoading, isEnsuring, ensureDefaultWorkspace]);

  const workspaceId = workspaces?.[0]?.id;
  const { data: collections, isLoading } = useCollections(workspaceId);
  const { mutate: createCollection, isPending: isCreating } = useCreateCollection();
  const { mutate: deleteCollection, isPending: isDeleting } = useDeleteCollection();
  
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionWithCount | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionColor, setNewCollectionColor] = useState<string | null>(null);
  const [newCollectionIcon, setNewCollectionIcon] = useState<string>("folder");
  const [parentCollectionId, setParentCollectionId] = useState<number | null>(null);

  const handleCreateCollection = () => {
    if (!workspaceId || !newCollectionName.trim()) return;
    createCollection(
      { 
        workspaceId,
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim() || null,
        color: newCollectionColor,
        icon: newCollectionIcon,
        parentId: parentCollectionId
      },
      {
        onSuccess: () => {
          toast({ title: "Collection created", description: "Your new collection is ready." });
          resetForm();
          setIsCreateModalOpen(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create collection.", variant: "destructive" });
        }
      }
    );
  };

  const handleDeleteCollection = (id: number, flowCount: number) => {
    if (flowCount > 0) {
      toast({ 
        title: "Cannot delete", 
        description: "Move or delete flows in this collection first.", 
        variant: "destructive" 
      });
      return;
    }
    deleteCollection(id, {
      onSuccess: () => {
        toast({ title: "Collection deleted" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete collection.", variant: "destructive" });
      }
    });
  };

  const resetForm = () => {
    setNewCollectionName("");
    setNewCollectionDescription("");
    setNewCollectionColor(null);
    setNewCollectionIcon("folder");
    setParentCollectionId(null);
  };

  const filteredCollections = collections?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const rootCollections = filteredCollections?.filter(c => !c.parentId);
  const getChildCollections = (parentId: number) => 
    filteredCollections?.filter(c => c.parentId === parentId) || [];

  const renderCollection = (collection: CollectionWithCount, depth = 0) => {
    const children = getChildCollections(collection.id);
    
    return (
      <div key={collection.id}>
        <div 
          className={cn(
            "group bg-card border border-border hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5 transition-all rounded-xl p-4 flex items-center gap-4",
            depth > 0 && "ml-6"
          )}
        >
          <div 
            className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: collection.color || 'hsl(var(--muted))' }}
          >
            <FolderOpen className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <Link href={`/collections/${collection.id}`}>
              <h3 className="font-bold text-base font-display truncate group-hover:text-primary transition-colors cursor-pointer">
                {collection.name}
              </h3>
            </Link>
            <p className="text-muted-foreground text-sm truncate">
              {collection.flowCount} {collection.flowCount === 1 ? 'flow' : 'flows'}
              {collection.description && ` - ${collection.description}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {children.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {children.length} sub-collection{children.length !== 1 ? 's' : ''}
              </span>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-collection-menu-${collection.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => {
                    setParentCollectionId(collection.id);
                    setIsCreateModalOpen(true);
                  }}
                  data-testid={`button-add-subcollection-${collection.id}`}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Sub-collection
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setEditingCollection(collection)}
                  data-testid={`button-edit-collection-${collection.id}`}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteCollection(collection.id, collection.flowCount)}
                  className="text-destructive"
                  data-testid={`button-delete-collection-${collection.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Link href={`/collections/${collection.id}`}>
              <Button variant="ghost" size="icon" data-testid={`button-open-collection-${collection.id}`}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        
        {children.length > 0 && (
          <div className="mt-2 space-y-2">
            {children.map(child => renderCollection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <MobileMenuTrigger />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Collections</h1>
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">Organize your flows into collections.</p>
                </div>
              </div>
              <Button 
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(true);
                }} 
                disabled={isCreating}
                className="rounded-full px-4 sm:px-6 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                data-testid="button-new-collection"
              >
                <Plus className="mr-2 h-4 w-4" /> New Collection
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="relative flex-1 max-w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search collections..." 
                className="pl-9 bg-card border-border rounded-xl" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-collections"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
            </div>
          ) : rootCollections?.length === 0 ? (
            <EmptyState 
              icon={FolderOpen}
              title="No collections yet"
              description={search ? "Try a different search term." : "Create your first collection to organize your flows."}
              actionLabel={search ? undefined : "Create Collection"}
              onAction={search ? undefined : () => setIsCreateModalOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {rootCollections?.map(collection => renderCollection(collection))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {parentCollectionId ? "Create Sub-collection" : "Create Collection"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Onboarding Flows"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                data-testid="input-collection-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What flows will be in this collection?"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-collection-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setNewCollectionColor(color.value)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      newCollectionColor === color.value 
                        ? "border-foreground scale-110" 
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value || 'hsl(var(--muted))' }}
                    title={color.name}
                    data-testid={`button-color-${color.name.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCollection} 
              disabled={!newCollectionName.trim() || isCreating}
              data-testid="button-create-collection-submit"
            >
              {isCreating ? "Creating..." : "Create Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
