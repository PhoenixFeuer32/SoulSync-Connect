import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainLayout from "@/components/layout/main-layout";
import Dashboard from "@/pages/dashboard";
import CallInterface from "@/pages/call-interface";
import Companions from "@/pages/companions";
import SpotifyIntegration from "@/pages/spotify-integration";
import FileSharing from "@/pages/file-sharing";
import SmsManagement from "@/pages/sms-management";
import ApiCredentials from "@/pages/api-credentials";
import Diagnostics from "@/pages/diagnostics";
import SetupGuide from "@/pages/setup-guide";
import LegalTos from "@/pages/legal-tos";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/call-interface" component={CallInterface} />
        <Route path="/companions" component={Companions} />
        <Route path="/spotify-integration" component={SpotifyIntegration} />
        <Route path="/file-sharing" component={FileSharing} />
        <Route path="/sms-management" component={SmsManagement} />
        <Route path="/api-credentials" component={ApiCredentials} />
        <Route path="/diagnostics" component={Diagnostics} />
        <Route path="/setup-guide" component={SetupGuide} />
        <Route path="/legal-tos" component={LegalTos} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark min-h-screen bg-background text-foreground">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
