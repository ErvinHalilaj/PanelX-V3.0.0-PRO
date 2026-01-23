import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Tv, 
  Users, 
  Layers, 
  Settings, 
  Server, 
  LogOut,
  Film,
  UserCog,
  Wifi,
  Code,
  Clapperboard,
  Shield,
  Smartphone,
  Radio,
  CalendarClock,
  Ban,
  Package,
  UsersRound,
  MessageSquare,
  TrendingUp,
  Archive,
  Webhook,
  User,
  Activity,
  CreditCard,
  Clock,
  MonitorPlay,
  FileText,
  FileOutput,
  ShieldBan,
  Zap,
  Monitor,
  Bell,
  SlidersHorizontal,
  Globe,
  Gift,
  History,
  Eye,
  Key,
  Fingerprint,
  FolderOpen,
  Repeat,
  ShieldAlert,
  BarChart3,
  UserCheck,
  Video
} from "lucide-react";
import { useAdminAuth } from "./AdminAuthProvider";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAdminAuth();

  const mainNav = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  ];

  const contentNav = [
    { icon: Tv, label: "Live Streams", href: "/streams" },
    { icon: Video, label: "Recordings (DVR)", href: "/recordings" },
    { icon: Clock, label: "Timeshift & Catchup", href: "/timeshift" },
    { icon: Settings, label: "Adaptive Bitrate", href: "/adaptive-bitrate" },
    { icon: Radio, label: "Created Channels", href: "/created-channels" },
    { icon: Activity, label: "Stream Status", href: "/stream-status" },
    { icon: Film, label: "Movies (VOD)", href: "/movies" },
    { icon: Clapperboard, label: "Series", href: "/series" },
    { icon: Layers, label: "Categories", href: "/categories" },
    { icon: Layers, label: "Bouquets", href: "/bouquets" },
    { icon: CalendarClock, label: "EPG Sources", href: "/epg" },
    { icon: FileText, label: "EPG Data", href: "/epg-data" },
    { icon: FolderOpen, label: "Watch Folders", href: "/watch-folders" },
    { icon: Repeat, label: "24/7 Channels", href: "/looping-channels" },
    { icon: Eye, label: "Most Watched", href: "/most-watched" },
  ];

  const usersNav = [
    { icon: Users, label: "Lines", href: "/lines" },
    { icon: MonitorPlay, label: "MAG Devices", href: "/mag-devices" },
    { icon: Monitor, label: "Enigma2 Devices", href: "/enigma2-devices" },
    { icon: UserCog, label: "Users/Resellers", href: "/users" },
    { icon: UsersRound, label: "Reseller Groups", href: "/reseller-groups" },
    { icon: Package, label: "Packages", href: "/packages" },
    { icon: Wifi, label: "Connections", href: "/connections" },
    { icon: History, label: "Connection History", href: "/connection-history" },
    { icon: CreditCard, label: "Credit History", href: "/credit-transactions" },
    { icon: Gift, label: "Activation Codes", href: "/activation-codes" },
    { icon: MessageSquare, label: "Tickets", href: "/tickets" },
    { icon: TrendingUp, label: "Reseller Panel", href: "/reseller" },
  ];

  const securityNav = [
    { icon: Ban, label: "Blocked IPs", href: "/blocked-ips" },
    { icon: Shield, label: "Blocked UAs", href: "/blocked-uas" },
    { icon: ShieldBan, label: "Reserved Usernames", href: "/reserved-usernames" },
    { icon: ShieldAlert, label: "Autoblock Rules", href: "/autoblock-rules" },
    { icon: Key, label: "Two-Factor Auth", href: "/two-factor" },
    { icon: Fingerprint, label: "Fingerprinting", href: "/fingerprinting" },
    { icon: UserCheck, label: "Impersonation Logs", href: "/impersonation-logs" },
  ];

  const systemNav = [
    { icon: Server, label: "Servers", href: "/servers" },
    { icon: Smartphone, label: "Device Templates", href: "/devices" },
    { icon: SlidersHorizontal, label: "Transcode", href: "/transcode" },
    { icon: FileOutput, label: "Output Types", href: "/access-outputs" },
    { icon: Bell, label: "Signals/Triggers", href: "/signals" },
    { icon: Clock, label: "Cron Jobs", href: "/cron-jobs" },
    { icon: Activity, label: "Activity Logs", href: "/activity-logs" },
    { icon: BarChart3, label: "Stats Snapshots", href: "/stats-snapshots" },
    { icon: Archive, label: "Backups", href: "/backups" },
    { icon: Webhook, label: "Webhooks", href: "/webhooks" },
    { icon: Globe, label: "Client Portal", href: "/portal" },
    { icon: Code, label: "API Info", href: "/api" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  const renderNav = (items: typeof mainNav) => (
    <>
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          <div className={`nav-item cursor-pointer group ${location === item.href ? "active" : ""}`} data-testid={`nav-${item.href.replace('/', '') || 'dashboard'}`}>
            <item.icon className="w-5 h-5 group-hover:text-primary transition-colors" />
            <span>{item.label}</span>
          </div>
        </Link>
      ))}
    </>
  );

  return (
    <aside className="w-64 bg-secondary/30 backdrop-blur-md border-r border-white/5 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6">
        <h1 className="text-2xl font-display font-bold text-white tracking-wider flex items-center gap-2">
          <span className="w-2 h-8 bg-primary rounded-full inline-block" />
          Panel<span className="text-primary">X</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1 ml-4 font-mono">v3.0.0-PRO</p>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="mb-4">
          {renderNav(mainNav)}
        </div>

        <div className="mb-4">
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</p>
          {renderNav(contentNav)}
        </div>

        <div className="mb-4">
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Users</p>
          {renderNav(usersNav)}
        </div>

        <div className="mb-4">
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Security</p>
          {renderNav(securityNav)}
        </div>

        <div className="mb-4">
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">System</p>
          {renderNav(systemNav)}
        </div>
      </nav>

      <div className="p-4 border-t border-white/5 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" 
          data-testid="button-signout"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
