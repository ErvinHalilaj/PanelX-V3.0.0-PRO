import { Link, useLocation } from "wouter";
import { useState } from "react";
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
  Video,
  ImagePlus,
  Calendar,
  Palette,
  ShoppingBag,
  Receipt,
  Lock,
  ChevronDown,
  ChevronRight,
  Play,
  Database,
  ShoppingCart,
  type LucideIcon
} from "lucide-react";
import { useAdminAuth } from "./AdminAuthProvider";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

interface NavSection {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
}

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAdminAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    content: true,
    users: true,
    security: false,
    system: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navSections: NavSection[] = [
    {
      title: "Content & Streams",
      icon: Play,
      items: [
        { icon: Tv, label: "Live Streams", href: "/streams" },
        { icon: Activity, label: "Stream Monitoring", href: "/stream-monitoring" },
        { icon: Video, label: "Recordings (DVR)", href: "/recordings" },
        { icon: Clock, label: "Timeshift & Catchup", href: "/timeshift" },
        { icon: Archive, label: "Catchup Settings", href: "/catchup-settings" },
        { icon: Film, label: "On-Demand Settings", href: "/on-demand-settings" },
        { icon: Settings, label: "Adaptive Bitrate", href: "/adaptive-bitrate" },
        { icon: Calendar, label: "Stream Schedules", href: "/schedules" },
        { icon: ImagePlus, label: "Media Manager", href: "/media-manager" },
        { icon: BarChart3, label: "Analytics", href: "/analytics" },
        { icon: TrendingUp, label: "Advanced Analytics", href: "/advanced-analytics" },
        { icon: Radio, label: "Created Channels", href: "/created-channels" },
        { icon: Activity, label: "Stream Status", href: "/stream-status" },
        { icon: Film, label: "Movies (VOD)", href: "/movies" },
        { icon: Clapperboard, label: "Series", href: "/series" },
        { icon: Layers, label: "Categories", href: "/categories" },
        { icon: Layers, label: "Bouquets", href: "/bouquets" },
        { icon: CalendarClock, label: "EPG Sources", href: "/epg" },
        { icon: CalendarClock, label: "EPG Manager", href: "/epg-manager" },
        { icon: FileText, label: "EPG Data", href: "/epg-data" },
        { icon: FolderOpen, label: "Watch Folders", href: "/watch-folders" },
        { icon: Repeat, label: "24/7 Channels", href: "/looping-channels" },
        { icon: Eye, label: "Most Watched", href: "/most-watched" },
      ],
    },
    {
      title: "Users & Subscriptions",
      icon: Users,
      items: [
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
        { icon: Code, label: "Embedded Lines", href: "/embedded-lines" },
        { icon: MessageSquare, label: "Tickets", href: "/tickets" },
        { icon: ShoppingBag, label: "Shop Products", href: "/shop-products" },
        { icon: Receipt, label: "Shop Orders", href: "/shop-orders" },
        { icon: TrendingUp, label: "Reseller Panel", href: "/reseller" },
      ],
    },
    {
      title: "Security",
      icon: Shield,
      items: [
        { icon: Shield, label: "Security Settings", href: "/security" },
        { icon: ShieldAlert, label: "Advanced Security", href: "/advanced-security" },
        { icon: Users, label: "Reseller Management", href: "/reseller-management" },
        { icon: Palette, label: "Branding", href: "/branding" },
        { icon: Ban, label: "Blocked IPs", href: "/blocked-ips" },
        { icon: Shield, label: "Blocked UAs", href: "/blocked-uas" },
        { icon: ShieldBan, label: "Reserved Usernames", href: "/reserved-usernames" },
        { icon: ShieldAlert, label: "Autoblock Rules", href: "/autoblock-rules" },
        { icon: ShieldAlert, label: "VPN Detection", href: "/vpn-detection" },
        { icon: Key, label: "Two-Factor Auth", href: "/two-factor" },
        { icon: Fingerprint, label: "Fingerprinting", href: "/fingerprinting" },
        { icon: UserCheck, label: "Impersonation Logs", href: "/impersonation-logs" },
      ],
    },
    {
      title: "System",
      icon: Server,
      items: [
        { icon: Server, label: "Servers", href: "/servers" },
        { icon: Smartphone, label: "Device Templates", href: "/devices" },
        { icon: SlidersHorizontal, label: "Transcode", href: "/transcode" },
        { icon: FileOutput, label: "Output Types", href: "/access-outputs" },
        { icon: Bell, label: "Signals/Triggers", href: "/signals" },
        { icon: Bell, label: "Notifications", href: "/notifications" },
        { icon: Clock, label: "Cron Jobs", href: "/cron-jobs" },
        { icon: Activity, label: "System Monitoring", href: "/monitoring" },
        { icon: Activity, label: "Activity Logs", href: "/activity-logs" },
        { icon: BarChart3, label: "Stats Snapshots", href: "/stats-snapshots" },
        { icon: Lock, label: "SSL Certificates", href: "/ssl-certificates" },
        { icon: Archive, label: "Backups", href: "/backups" },
        { icon: Archive, label: "Backup Scheduler", href: "/backup-scheduler" },
        { icon: Webhook, label: "Webhooks", href: "/webhooks" },
        { icon: Globe, label: "Client Portal", href: "/portal" },
        { icon: Code, label: "API Info", href: "/api" },
        { icon: Globe, label: "GeoIP Restrictions", href: "/geoip" },
        { icon: Activity, label: "Bandwidth Monitoring", href: "/bandwidth" },
        { icon: Zap, label: "Load Balancing", href: "/load-balancing" },
        { icon: Settings, label: "Settings", href: "/settings" },
      ],
    },
  ];

  const sectionKeys = ['content', 'users', 'security', 'system'];

  return (
    <aside className="w-[260px] bg-sidebar-background border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Play className="w-4 h-4 text-primary-foreground fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Panel<span className="text-primary">X</span>
            </h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wide">v3.0.0 PRO</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <Link href="/">
          <div 
            className={cn(
              "nav-item cursor-pointer mb-2",
              location === "/" && "active"
            )} 
            data-testid="nav-dashboard"
          >
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span>Dashboard</span>
          </div>
        </Link>

        {navSections.map((section, index) => {
          const sectionKey = sectionKeys[index];
          const isOpen = openSections[sectionKey];
          const hasActiveItem = section.items.some(item => location === item.href);
          
          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(sectionKey)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
                  hasActiveItem ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <section.icon className="w-3.5 h-3.5" />
                  <span>{section.title}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              
              {isOpen && (
                <div className="mt-1 space-y-0.5 animate-fade-in">
                  {section.items.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <div 
                        className={cn(
                          "nav-item cursor-pointer text-[13px] pl-8",
                          location === item.href && "active"
                        )} 
                        data-testid={`nav-${item.href.replace('/', '') || 'dashboard'}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" 
          data-testid="button-signout"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
