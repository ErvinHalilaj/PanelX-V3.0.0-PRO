import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, Search, Settings } from "lucide-react";
import { useAdminAuth } from "./AdminAuthProvider";

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const { user } = useAdminAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main className="pl-[260px]">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-80 hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                placeholder="Search..." 
                className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
                data-testid="input-global-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
              data-testid="button-notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </button>
            <button 
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
              data-testid="button-settings-quick"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
            <div className="flex items-center gap-3 pl-3 ml-2 border-l border-border">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user?.username || 'Admin'}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role || 'Administrator'}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20">
                {(user?.username || 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="page-header">
            <div>
              <h2 className="page-title">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>

          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
