import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Collection } from "@shared/schema";

export interface CollectionWithCount extends Collection {
  flowCount: number;
}

export function useCollections(workspaceId?: number) {
  return useQuery<CollectionWithCount[]>({
    queryKey: ['/api/workspaces', workspaceId, 'collections'],
    enabled: !!workspaceId,
  });
}

export function useCollection(id?: number) {
  return useQuery<CollectionWithCount>({
    queryKey: ['/api/collections', id],
    enabled: !!id,
  });
}

export function useCreateCollection() {
  return useMutation({
    mutationFn: async (data: { 
      workspaceId: number; 
      name: string; 
      description?: string | null;
      color?: string | null;
      icon?: string | null;
      parentId?: number | null;
    }) => {
      const res = await apiRequest(
        "POST", 
        `/api/workspaces/${data.workspaceId}/collections`,
        { 
          name: data.name,
          description: data.description,
          color: data.color,
          icon: data.icon,
          parentId: data.parentId
        }
      );
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/workspaces', variables.workspaceId, 'collections'] 
      });
    },
  });
}

export function useUpdateCollection() {
  return useMutation({
    mutationFn: async ({ 
      id, 
      ...data 
    }: { 
      id: number; 
      name?: string;
      description?: string | null;
      color?: string | null;
      icon?: string | null;
      parentId?: number | null;
    }) => {
      const res = await apiRequest("PUT", `/api/collections/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
    },
  });
}

export function useDeleteCollection() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
    },
  });
}

export function useMoveFlowToCollection() {
  return useMutation({
    mutationFn: async ({ flowId, collectionId }: { flowId: number; collectionId: number | null }) => {
      const res = await apiRequest("POST", `/api/flows/${flowId}/move`, { collectionId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
    },
  });
}
