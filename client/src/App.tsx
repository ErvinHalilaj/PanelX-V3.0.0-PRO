import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Streams from "@/pages/Streams";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/streams" component={Streams} />
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
      <Route path="/reseller" component={ResellerDashboard} />
      <Route path="/backups" component={Backups} />
      <Route path="/settings" component={Settings} />
      <Route path="/api" component={ApiInfo} />
      <Route path="/portal" component={ClientPortal} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
