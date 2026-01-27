import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Streams from "@/pages/Streams";
import Recordings from "@/pages/Recordings";
import Timeshift from "@/pages/Timeshift";
import AdaptiveBitrate from "@/pages/AdaptiveBitrate";
import Schedules from "@/pages/Schedules";
import MediaManager from "@/pages/MediaManager";
import Analytics from "@/pages/Analytics";
import Security from "@/pages/Security";
import AdvancedSecurity from "@/pages/AdvancedSecurity";
import Branding from "@/pages/Branding";
import BackupsManager from "@/pages/BackupsManager";
import ResellerManagement from "@/pages/ResellerManagement";
import Lines from "@/pages/Lines";
import Categories from "@/pages/Categories";
import Bouquets from "@/pages/Bouquets";
import Users from "@/pages/Users";
import Connections from "@/pages/Connections";
import ApiInfo from "@/pages/ApiInfo";
import Servers from "@/pages/Servers";
import Series from "@/pages/Series";
import Movies from "@/pages/Movies";
import BlockedIps from "@/pages/BlockedIps";
import BlockedUAs from "@/pages/BlockedUAs";
import DeviceTemplates from "@/pages/DeviceTemplates";
import EpgSources from "@/pages/EpgSources";
import TranscodeProfiles from "@/pages/TranscodeProfiles";
import Episodes from "@/pages/Episodes";
import Settings from "@/pages/Settings";
import ClientPortal from "@/pages/ClientPortal";
import Packages from "@/pages/Packages";
import ResellerGroups from "@/pages/ResellerGroups";
import Tickets from "@/pages/Tickets";
import ResellerDashboard from "@/pages/ResellerDashboard";
import Backups from "@/pages/Backups";
import Webhooks from "@/pages/Webhooks";
import ActivityLogs from "@/pages/ActivityLogs";
import CreditTransactions from "@/pages/CreditTransactions";
import CronJobs from "@/pages/CronJobs";
import SystemMonitoring from "@/pages/SystemMonitoring";
import EpgDataViewer from "@/pages/EpgDataViewer";
import MagDevices from "@/pages/MagDevices";
import StreamStatus from "@/pages/StreamStatus";
import AccessOutputs from "@/pages/AccessOutputs";
import ReservedUsernames from "@/pages/ReservedUsernames";
import CreatedChannels from "@/pages/CreatedChannels";
import Enigma2Devices from "@/pages/Enigma2Devices";
import Signals from "@/pages/Signals";
import ActivationCodes from "@/pages/ActivationCodes";
import ConnectionHistory from "@/pages/ConnectionHistory";
import MostWatched from "@/pages/MostWatched";
import TwoFactorAuth from "@/pages/TwoFactorAuth";
import Fingerprinting from "@/pages/Fingerprinting";
import WatchFolders from "@/pages/WatchFolders";
import LoopingChannels from "@/pages/LoopingChannels";
import AutoblockRules from "@/pages/AutoblockRules";
import StatsSnapshots from "@/pages/StatsSnapshots";
import ImpersonationLogs from "@/pages/ImpersonationLogs";
import { AdminAuthProvider, useAdminAuth } from "@/components/AdminAuthProvider";
import { Sidebar } from "@/components/Sidebar";

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/streams" component={Streams} />
      <Route path="/recordings" component={Recordings} />
      <Route path="/timeshift" component={Timeshift} />
      <Route path="/adaptive-bitrate" component={AdaptiveBitrate} />
      <Route path="/schedules" component={Schedules} />
      <Route path="/media-manager" component={MediaManager} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/security" component={Security} />
      <Route path="/advanced-security" component={AdvancedSecurity} />
      <Route path="/branding" component={Branding} />
      <Route path="/reseller-management" component={ResellerManagement} />
      <Route path="/movies" component={Movies} />
      <Route path="/series" component={Series} />
      <Route path="/series/:seriesId/episodes" component={Episodes} />
      <Route path="/lines" component={Lines} />
      <Route path="/users" component={Users} />
      <Route path="/connections" component={Connections} />
      <Route path="/categories" component={Categories} />
      <Route path="/bouquets" component={Bouquets} />
      <Route path="/epg" component={EpgSources} />
      <Route path="/servers" component={Servers} />
      <Route path="/blocked-ips" component={BlockedIps} />
      <Route path="/blocked-uas" component={BlockedUAs} />
      <Route path="/devices" component={DeviceTemplates} />
      <Route path="/transcode" component={TranscodeProfiles} />
      <Route path="/packages" component={Packages} />
      <Route path="/reseller-groups" component={ResellerGroups} />
      <Route path="/tickets" component={Tickets} />
      <Route path="/backups" component={BackupsManager} />
      <Route path="/webhooks" component={Webhooks} />
      <Route path="/activity-logs" component={ActivityLogs} />
      <Route path="/credit-transactions" component={CreditTransactions} />
      <Route path="/cron-jobs" component={CronJobs} />
      <Route path="/monitoring" component={SystemMonitoring} />
      <Route path="/epg-data" component={EpgDataViewer} />
      <Route path="/mag-devices" component={MagDevices} />
      <Route path="/stream-status" component={StreamStatus} />
      <Route path="/access-outputs" component={AccessOutputs} />
      <Route path="/reserved-usernames" component={ReservedUsernames} />
      <Route path="/created-channels" component={CreatedChannels} />
      <Route path="/enigma2-devices" component={Enigma2Devices} />
      <Route path="/signals" component={Signals} />
      <Route path="/activation-codes" component={ActivationCodes} />
      <Route path="/connection-history" component={ConnectionHistory} />
      <Route path="/most-watched" component={MostWatched} />
      <Route path="/two-factor" component={TwoFactorAuth} />
      <Route path="/fingerprinting" component={Fingerprinting} />
      <Route path="/watch-folders" component={WatchFolders} />
      <Route path="/looping-channels" component={LoopingChannels} />
      <Route path="/autoblock-rules" component={AutoblockRules} />
      <Route path="/stats-snapshots" component={StatsSnapshots} />
      <Route path="/impersonation-logs" component={ImpersonationLogs} />
      <Route path="/settings" component={Settings} />
      <Route path="/api" component={ApiInfo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminPanel() {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <h1 className="text-4xl">Admin Panel Loaded!</h1>
      </div>
    </AdminAuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/portal" component={ClientPortal} />
          <Route path="/reseller" component={ResellerDashboard} />
          <Route>
            <AdminPanel />
          </Route>
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
