import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Tv, 
  Users, 
  Layers, 
  Settings, 
  Server, 
  LogOut,
  Clapperboard
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Tv, label: "Live Streams", href: "/streams" },
    { icon: Clapperboard, label: "Movies & Series", href: "/movies" },
    { icon: Users, label: "Users & Lines", href: "/lines" },
    { icon: Layers, label: "Bouquets", href: "/bouquets" },
    { icon: Layers, label: "Categories", href: "/categories" },
    { icon: Server, label: "Manage Servers", href: "/servers" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <aside className="w-64 bg-secondary/30 backdrop-blur-md border-r border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-white tracking-wider flex items-center gap-2">
          <span className="w-2 h-8 bg-primary rounded-full inline-block" />
          Panel<span className="text-primary">X</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1 ml-4 font-mono">v3.0.0-PRO</p>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={`nav-item cursor-pointer group ${location === item.href ? "active" : ""}`}>
              <item.icon className="w-5 h-5 group-hover:text-primary transition-colors" />
              <span>{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
