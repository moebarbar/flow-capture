// This is a placeholder since authentication is handled via Replit Auth routes (/api/login)
// But we might want a custom look if we were doing custom auth.
// Since we use Replit Auth, this page is mainly for redirects or info.
import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    window.location.href = "/api/login";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-12 bg-brand-200 rounded-full mb-4"></div>
        <div className="text-muted-foreground">Redirecting to login...</div>
      </div>
    </div>
  );
}
