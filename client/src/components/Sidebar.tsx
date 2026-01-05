import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, BookOpen, Settings, LogOut, Plus, ChevronDown, ChevronLeft, ChevronRight, BarChart3, LayoutTemplate, Cog, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SIDEBAR_COLLAPSED_KEY = "flowcapture-sidebar-collapsed";

export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  return { isCollapsed, setIsCollapsed, toggle: () => setIsCollapsed(prev => !prev) };
}

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: workspaces } = useWorkspaces();
  const { isCollapsed, toggle } = useSidebarState();

  // Basic mock active workspace for now
  const activeWorkspace = workspaces?.[0];

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/guides", label: "My Guides", icon: BookOpen },
    { href: "/studio", label: "Screenshot Studio", icon: Sparkles },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/workspace-settings", label: "Workspace Settings", icon: Cog },
    { href: "/settings", label: "Account", icon: Settings },
  ];

  return (
    <div 
      className={cn(
        "h-screen border-r border-border bg-card flex flex-col fixed left-0 top-0 z-40 transition-all duration-200",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="absolute -right-3 top-6 h-6 w-6 rounded-full border border-border bg-card shadow-sm z-50"
        data-testid="button-toggle-sidebar"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Workspace Selector */}
      <div className={cn("border-b border-border", isCollapsed ? "p-2" : "p-4")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full font-normal hover:bg-muted/50",
                isCollapsed ? "justify-center p-2" : "justify-between px-2"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                  {activeWorkspace?.name?.[0] || "W"}
                </div>
                {!isCollapsed && (
                  <span className="truncate">{activeWorkspace?.name || "Select Workspace"}</span>
                )}
              </div>
              {!isCollapsed && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces?.map((ws) => (
              <DropdownMenuItem key={ws.id} className="cursor-pointer">
                {ws.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer text-primary">
              <Plus className="h-4 w-4" /> Create Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <div className={cn("flex-1 py-4 space-y-1", isCollapsed ? "px-2" : "px-3")}>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          
          const navItem = (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && link.label}
              </div>
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={link.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  {navItem}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {link.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          
          return navItem;
        })}
      </div>

      {/* User Profile */}
      <div className={cn("border-t border-border", isCollapsed ? "p-2" : "p-4")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full hover:bg-muted/50",
                isCollapsed ? "justify-center p-2" : "justify-start px-2 gap-3"
              )}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-medium shrink-0">
                {user?.firstName?.[0] || user?.email?.[0] || "U"}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="text-sm font-medium truncate w-full">{user?.firstName || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate w-full">{user?.email}</span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="top">
            <DropdownMenuItem className="text-destructive gap-2 cursor-pointer" onClick={() => logout()}>
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
