import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Guide, InsertGuide } from "@shared/schema";
import { z } from "zod";

type PaginatedGuidesResponse = z.infer<typeof api.guides.list.responses[200]>;

interface GuidesFilters {
  workspaceId?: number;
  folderId?: number;
  status?: "draft" | "published" | "archived";
  page?: number;
  limit?: number;
}

export function useGuides(filters?: GuidesFilters) {
  return useQuery<PaginatedGuidesResponse>({
    queryKey: [api.guides.list.path, filters],
    queryFn: async () => {
      let url = api.guides.list.path;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.workspaceId) params.append("workspaceId", String(filters.workspaceId));
        if (filters.folderId) params.append("folderId", String(filters.folderId));
        if (filters.status) params.append("status", filters.status);
        if (filters.page) params.append("page", String(filters.page));
        if (filters.limit) params.append("limit", String(filters.limit));
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch guides");
      const data = await res.json();
      return api.guides.list.responses[200].parse(data);
    },
    staleTime: 30000,
  });
}

export function useInfiniteGuides(filters?: Omit<GuidesFilters, 'page'>) {
  return useInfiniteQuery<PaginatedGuidesResponse>({
    queryKey: [api.guides.list.path, 'infinite', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      if (filters?.workspaceId) params.append("workspaceId", String(filters.workspaceId));
      if (filters?.folderId) params.append("folderId", String(filters.folderId));
      if (filters?.status) params.append("status", filters.status);
      if (filters?.limit) params.append("limit", String(filters.limit));
      params.append("page", String(pageParam));
      
      const res = await fetch(`${api.guides.list.path}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch guides");
      const data = await res.json();
      return api.guides.list.responses[200].parse(data);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30000,
  });
}

export function useGuide(id: number) {
  return useQuery({
    queryKey: [api.guides.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.guides.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch guide");
      return api.guides.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

export function useCreateGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertGuide) => {
      const res = await fetch(api.guides.create.path, {
        method: api.guides.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create guide");
      return api.guides.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.guides.list.path] }),
  });
}

export function useUpdateGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertGuide>) => {
      const url = buildUrl(api.guides.update.path, { id });
      const res = await fetch(url, {
        method: api.guides.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update guide");
      return api.guides.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.guides.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.guides.get.path, data.id] });
    },
  });
}

export function useDeleteGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.guides.delete.path, { id });
      const res = await fetch(url, { method: api.guides.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete guide");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.guides.list.path] }),
  });
}
