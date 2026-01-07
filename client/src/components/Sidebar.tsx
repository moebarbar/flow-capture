import { useState, useEffect, useCallback, memo, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, BookOpen, Settings, LogOut, Plus, ChevronDown, ChevronLeft, ChevronRight, BarChart3, LayoutTemplate, Cog, Sparkles, Moon, Sun, Users, Menu, X, Plug, FileText, FolderOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useTheme } from "@/components/ThemeProvider";
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

interface SidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  setIsCollapsed: (value: boolean) => void;
  setIsMobileOpen: (value: boolean) => void;
  toggle: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Close mobile menu on route change
  const [location] = useLocation();
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const value: SidebarContextType = {
    isCollapsed,
    isMobileOpen,
    setIsCollapsed,
    setIsMobileOpen,
    toggle: () => setIsCollapsed(prev => !prev),
    toggleMobile: () => setIsMobileOpen(prev => !prev),
    closeMobile: () => setIsMobileOpen(false),
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) {
    // Fallback for pages that don't use SidebarProvider
    const [isCollapsed, setIsCollapsed] = useState(() => {
      if (typeof window !== "undefined") {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
      }
      return false;
    });
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return {
      isCollapsed,
      isMobileOpen,
      setIsCollapsed,
      setIsMobileOpen,
      toggle: () => setIsCollapsed((prev: boolean) => !prev),
      toggleMobile: () => setIsMobileOpen((prev: boolean) => !prev),
      closeMobile: () => setIsMobileOpen(false),
    };
  }
  return context;
}

// Mobile menu trigger button for header
export const MobileMenuTrigger = memo(function MobileMenuTrigger() {
  const { isMobileOpen, toggleMobile } = useSidebarState();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMobile}
      className="lg:hidden"
      data-testid="button-mobile-menu"
      aria-label={isMobileOpen ? "Close menu" : "Open menu"}
      aria-expanded={isMobileOpen}
    >
      {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </Button>
  );
});

const NavItem = memo(function NavItem({ 
  href, 
  label, 
  icon: Icon, 
  isActive, 
  isCollapsed,
  onClick
}: { 
  href: string; 
  label: string; 
  icon: typeof LayoutDashboard; 
  isActive: boolean; 
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  const navItem = (
    <Link href={href} onClick={onClick}>
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
        {!isCollapsed && label}
      </div>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {navItem}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return navItem;
});

export const Sidebar = memo(function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: workspaces } = useWorkspaces();
  const { isCollapsed, isMobileOpen, toggle, closeMobile } = useSidebarState();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const activeWorkspace = workspaces?.[0];

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/guides", label: "My Guides", icon: BookOpen },
    { href: "/collections", label: "Collections", icon: FolderOpen },
    { href: "/knowledge-base", label: "Knowledge Base", icon: FileText },
    { href: "/studio", label: "Screenshot Studio", icon: Sparkles },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    ...(activeWorkspace ? [{ href: `/workspaces/${activeWorkspace.id}/team`, label: "Team", icon: Users }] : []),
    { href: "/integrations", label: "Integrations", icon: Plug },
    { href: "/workspace-settings", label: "Workspace Settings", icon: Cog },
    { href: "/settings", label: "Account", icon: Settings },
  ];

  const sidebarContent = (
    <>
      {/* Workspace Selector */}
      <div className={cn("border-b border-border", isCollapsed && !isMobileOpen ? "p-2" : "p-4")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full font-normal hover:bg-muted/50",
                isCollapsed && !isMobileOpen ? "justify-center p-2" : "justify-between px-2"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                  {activeWorkspace?.name?.[0] || "W"}
                </div>
                {(!isCollapsed || isMobileOpen) && (
                  <span className="truncate">{activeWorkspace?.name || "Select Workspace"}</span>
                )}
              </div>
              {(!isCollapsed || isMobileOpen) && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
      <div className={cn("flex-1 py-4 space-y-1 overflow-y-auto", isCollapsed && !isMobileOpen ? "px-2" : "px-3")}>
        {links.map((link) => (
          <NavItem
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            isActive={location === link.href}
            isCollapsed={isCollapsed && !isMobileOpen}
            onClick={closeMobile}
          />
        ))}
      </div>

      {/* Theme Toggle */}
      <div className={cn("border-t border-border", isCollapsed && !isMobileOpen ? "p-2" : "px-3 py-2")}>
        {isCollapsed && !isMobileOpen ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="w-full"
                data-testid="button-theme-toggle"
              >
                {resolvedTheme === "dark" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={toggleTheme}
            className="w-full justify-start gap-3 px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="button-theme-toggle"
          >
            {resolvedTheme === "dark" ? (
              <Moon className="h-5 w-5 shrink-0" />
            ) : (
              <Sun className="h-5 w-5 shrink-0" />
            )}
            {resolvedTheme === "dark" ? "Dark mode" : "Light mode"}
          </Button>
        )}
      </div>

      {/* User Profile */}
      <div className={cn("border-t border-border", isCollapsed && !isMobileOpen ? "p-2" : "p-4")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full hover:bg-muted/50",
                isCollapsed && !isMobileOpen ? "justify-center p-2" : "justify-start px-2 gap-3"
              )}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-medium shrink-0">
                {user?.firstName?.[0] || user?.email?.[0] || "U"}
              </div>
              {(!isCollapsed || isMobileOpen) && (
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
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div 
        className={cn(
          "h-screen border-r border-border bg-card flex-col fixed left-0 top-0 z-40 transition-all duration-200 hidden lg:flex",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Toggle Button - Desktop only */}
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
        {sidebarContent}
      </div>

      {/* Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-200",
          isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-screen w-72 max-w-[85vw] bg-card border-r border-border z-50 flex flex-col lg:hidden transition-transform duration-200 ease-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-display font-bold text-lg">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobile}
            data-testid="button-close-mobile-menu"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {sidebarContent}
      </div>
    </>
  );
});
