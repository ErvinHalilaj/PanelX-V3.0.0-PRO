import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, Search, UserCircle } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  title: string;
  actions?: ReactNode;
}

export function Layout({ children, title, actions }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main className="pl-64">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 bg-background/50 backdrop-blur-sm sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                placeholder="Search streams, users, or settings..." 
                className="w-full bg-secondary/50 border border-white/5 rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-muted-foreground hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">Admin User</p>
                <p className="text-xs text-muted-foreground">Super Administrator</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <UserCircle className="w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-display font-bold text-white">{title}</h2>
              <p className="text-muted-foreground mt-1">Manage and monitor your IPTV platform</p>
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
