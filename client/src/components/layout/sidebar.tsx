import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useRealTimeData } from "@/hooks/use-real-time-data";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: "fas fa-home" },
  { path: "/call-interface", label: "Call Interface", icon: "fas fa-phone" },
  { path: "/companions", label: "Companions", icon: "fas fa-robot" },
  { path: "/spotify-integration", label: "Spotify Integration", icon: "fab fa-spotify" },
  { path: "/file-sharing", label: "File Sharing", icon: "fas fa-folder-open" },
  { path: "/sms-management", label: "SMS Management", icon: "fas fa-comment-sms" },
  { path: "/api-credentials", label: "API Credentials", icon: "fas fa-key" },
  { path: "/diagnostics", label: "Diagnostics", icon: "fas fa-chart-line" },
  { path: "/setup-guide", label: "Setup Guide", icon: "fas fa-book" },
  { path: "/legal-tos", label: "Legal & ToS", icon: "fas fa-shield-alt" },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { systemStatus } = useRealTimeData();

  return (
    <div className="w-72 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
            <i className="fas fa-brain text-primary-foreground text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">SoulSync Connect</h1>
            <p className="text-sm text-muted-foreground">AI Companion Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigationItems.map((item) => (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors",
              location === item.path
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <i className={cn(item.icon, "w-5 h-5")}></i>
            <span>{item.label}</span>
            {item.path === "/diagnostics" && (
              <span className="ml-auto w-2 h-2 bg-chart-1 rounded-full animate-pulse"></span>
            )}
          </button>
        ))}
      </nav>

      {/* Current Connection Status */}
      <div className="p-4 border-t border-border">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">System Status</span>
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                systemStatus?.overall === 'optimal' ? "bg-chart-2" : "bg-chart-1"
              )}></div>
              <span className="text-xs text-muted-foreground">
                {systemStatus?.overall || 'Loading...'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Kindroid API:</span>
              <span className={cn(
                systemStatus?.kindroid === 'connected' ? "text-chart-2" : "text-chart-1"
              )}>
                {systemStatus?.kindroid || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>ElevenLabs:</span>
              <span className={cn(
                systemStatus?.elevenlabs === 'connected' ? "text-chart-2" : "text-chart-1"
              )}>
                {systemStatus?.elevenlabs || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Twilio:</span>
              <span className={cn(
                systemStatus?.twilio === 'connected' ? "text-chart-2" : "text-chart-1"
              )}>
                {systemStatus?.twilio || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span className={cn(
                systemStatus?.database === 'healthy' ? "text-chart-2" : "text-chart-1"
              )}>
                {systemStatus?.database || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
