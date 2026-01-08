import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateStepRequest, type UpdateStepRequest } from "@shared/routes";

export function useSteps(guideId: number) {
  return useQuery({
    queryKey: [api.steps.list.path, guideId],
    queryFn: async () => {
      const url = buildUrl(api.steps.list.path, { guideId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch steps");
      return api.steps.list.responses[200].parse(await res.json());
    },
    enabled: !!guideId,
  });
}

export function useCreateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ guideId, ...data }: { guideId: number } & Omit<CreateStepRequest, "flowId">) => {
      const url = buildUrl(api.steps.create.path, { guideId });
      const res = await fetch(url, {
        method: api.steps.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, flowId: guideId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create step");
      return api.steps.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.steps.list.path, variables.guideId] });
      queryClient.invalidateQueries({ queryKey: [api.guides.get.path, variables.guideId] });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, guideId, ...updates }: { id: number; guideId: number } & UpdateStepRequest) => {
      const url = buildUrl(api.steps.update.path, { id });
      const res = await fetch(url, {
        method: api.steps.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update step");
      return api.steps.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.steps.list.path, variables.guideId] });
      queryClient.invalidateQueries({ queryKey: [api.guides.get.path, variables.guideId] });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, guideId }: { id: number; guideId: number }) => {
      const url = buildUrl(api.steps.delete.path, { id });
      const res = await fetch(url, { method: api.steps.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete step");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.steps.list.path, variables.guideId] });
      queryClient.invalidateQueries({ queryKey: [api.guides.get.path, variables.guideId] });
    },
  });
}

export function useReorderSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ guideId, stepIds }: { guideId: number; stepIds: number[] }) => {
      const url = buildUrl(api.steps.reorder.path, { guideId });
      const res = await fetch(url, {
        method: api.steps.reorder.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reorder steps");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.steps.list.path, variables.guideId] });
      queryClient.invalidateQueries({ queryKey: [api.guides.get.path, variables.guideId] });
    },
  });
}
