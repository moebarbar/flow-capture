import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useGenerateDescription() {
  return useMutation({
    mutationFn: async (data: { stepTitle: string; actionType: string; context?: string }) => {
      const res = await fetch(api.ai.generateDescription.path, {
        method: api.ai.generateDescription.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate AI description");
      return api.ai.generateDescription.responses[200].parse(await res.json());
    },
  });
}
