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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/streams" component={Streams} />
      <Route path="/lines" component={Lines} />
      <Route path="/categories" component={Categories} />
      <Route path="/bouquets" component={Bouquets} />
      
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
