import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import { useWorkspaces } from "@/hooks/use-workspaces";

const STORAGE_KEY = "flowcapture-active-workspace";

interface ActiveWorkspaceContextValue {
  activeWorkspaceId: number | null;
  setActiveWorkspaceId: (id: number) => void;
}

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | null>(null);

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<number | null>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const n = stored ? Number(stored) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  const setActiveWorkspaceId = useCallback((id: number) => {
    setActiveWorkspaceIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const value = useMemo(
    () => ({ activeWorkspaceId, setActiveWorkspaceId }),
    [activeWorkspaceId, setActiveWorkspaceId]
  );

  return <ActiveWorkspaceContext.Provider value={value}>{children}</ActiveWorkspaceContext.Provider>;
}

/**
 * Resolve the active workspace. Falls back to the first workspace when nothing
 * is selected or the selected id no longer exists. Safe to call outside the
 * provider (falls back to first workspace, no switching).
 */
export function useActiveWorkspace() {
  const ctx = useContext(ActiveWorkspaceContext);
  const { data: workspaces, isLoading } = useWorkspaces();

  const list = workspaces ?? [];
  const selected =
    ctx?.activeWorkspaceId != null ? list.find((w) => w.id === ctx.activeWorkspaceId) : undefined;
  const workspace = selected ?? list[0] ?? null;

  return {
    workspace,
    workspaceId: workspace?.id,
    workspaces: list,
    isLoading,
    setActiveWorkspaceId: ctx?.setActiveWorkspaceId ?? (() => {}),
  };
}
