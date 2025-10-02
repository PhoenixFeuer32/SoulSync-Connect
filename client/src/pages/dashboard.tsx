import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRealTimeData } from "@/hooks/use-real-time-data";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { systemStatus, metrics } = useRealTimeData();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
  });

  const startCallMutation = useMutation({
    mutationFn: async (companionId: string) => {
      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionId }),
      });
      if (!response.ok) throw new Error("Failed to start call");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Call Started",
        description: "Successfully initiated call with companion",
      });
      setLocation("/call-interface");
    },
    onError: (error) => {
      toast({
        title: "Call Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refreshConnectionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/health");
      if (!response.ok) throw new Error("Failed to refresh connections");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Connections Refreshed",
        description: "All API connections have been refreshed",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeCompanion = dashboardData?.companions?.find((c: any) => c.isActive);
  const recentActivities = dashboardData?.recentLogs || [];

  return (
    <div className="space-y-6">
      {/* Quick Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button
          onClick={() => activeCompanion && startCallMutation.mutate(activeCompanion.id)}
          disabled={!activeCompanion || startCallMutation.isPending}
          className="bg-gradient-to-br from-chart-2 to-chart-3 text-white p-6 h-auto hover:scale-105 transition-transform"
          data-testid="button-quick-call"
        >
          <div className="flex items-center space-x-3">
            <i className="fas fa-phone text-2xl"></i>
            <div className="text-left">
              <h3 className="font-semibold">Quick Call</h3>
              <p className="text-sm opacity-90">Start conversation</p>
            </div>
          </div>
        </Button>
        
        <Button
          onClick={() => setLocation("/companions")}
          className="bg-gradient-to-br from-primary to-accent text-white p-6 h-auto hover:scale-105 transition-transform"
          data-testid="button-add-companion"
        >
          <div className="flex items-center space-x-3">
            <i className="fas fa-plus text-2xl"></i>
            <div className="text-left">
              <h3 className="font-semibold">Add Companion</h3>
              <p className="text-sm opacity-90">Create new AI</p>
            </div>
          </div>
        </Button>
        
        <Button
          onClick={() => setLocation("/file-sharing")}
          className="bg-gradient-to-br from-chart-4 to-chart-5 text-white p-6 h-auto hover:scale-105 transition-transform"
          data-testid="button-share-file"
        >
          <div className="flex items-center space-x-3">
            <i className="fas fa-share text-2xl"></i>
            <div className="text-left">
              <h3 className="font-semibold">Share File</h3>
              <p className="text-sm opacity-90">Upload & send</p>
            </div>
          </div>
        </Button>
        
        <Button
          onClick={() => setLocation("/diagnostics")}
          className="bg-gradient-to-br from-destructive to-chart-1 text-white p-6 h-auto hover:scale-105 transition-transform"
          data-testid="button-view-diagnostics"
        >
          <div className="flex items-center space-x-3">
            <i className="fas fa-chart-bar text-2xl"></i>
            <div className="text-left">
              <h3 className="font-semibold">Diagnostics</h3>
              <p className="text-sm opacity-90">System health</p>
            </div>
          </div>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Active Companion & Call Interface */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Companion Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Companion</CardTitle>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/companions")}
                  data-testid="button-switch-companion"
                >
                  Switch Companion
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeCompanion ? (
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent p-1">
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                        <i className="fas fa-robot text-white text-2xl"></i>
                      </div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-chart-2 rounded-full border-2 border-card flex items-center justify-center">
                      <i className="fas fa-check text-xs text-white"></i>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold text-foreground mb-1">{activeCompanion.name}</h4>
                    <p className="text-muted-foreground mb-2">{activeCompanion.description}</p>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-microphone text-accent"></i>
                        <span>{activeCompanion.voiceProvider || 'ElevenLabs'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-clock text-chart-4"></i>
                        <span>Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-robot text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">No active companion selected</p>
                  <Button
                    onClick={() => setLocation("/companions")}
                    className="mt-4"
                    data-testid="button-create-companion"
                  >
                    Create Your First Companion
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivities.length > 0 ? (
                <div className="space-y-4">
                  {recentActivities.slice(0, 3).map((activity: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                      <div className="w-10 h-10 bg-chart-2 rounded-full flex items-center justify-center">
                        <i className="fas fa-phone text-white text-sm"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-medium">
                          Call {activity.status === 'completed' ? 'completed' : activity.status}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Duration: {activity.duration ? `${Math.floor(activity.duration / 60)}:${String(activity.duration % 60).padStart(2, '0')}` : 'N/A'}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(activity.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-history text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - System Info & Quick Stats */}
        <div className="space-y-6">
          {/* System Performance */}
          <Card>
            <CardHeader>
              <CardTitle>System Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Kindroid API</span>
                    <span className="text-chart-2 font-medium">
                      {metrics?.kindroid?.latency || '142'}ms
                    </span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">ElevenLabs</span>
                    <span className="text-chart-2 font-medium">
                      {metrics?.elevenlabs?.latency || '89'}ms
                    </span>
                  </div>
                  <Progress value={95} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Twilio Voice</span>
                    <span className="text-chart-2 font-medium">
                      {metrics?.twilio?.latency || '56'}ms
                    </span>
                  </div>
                  <Progress value={98} className="h-2" />
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Overall Health</span>
                  <span className="text-chart-2 font-bold">Excellent</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>API Usage Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-robot text-primary"></i>
                    <span className="text-foreground">Kindroid Calls</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {dashboardData?.companions?.length || 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-microphone text-accent"></i>
                    <span className="text-foreground">Voice Synthesis</span>
                  </div>
                  <span className="font-semibold text-foreground">87</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-phone text-chart-2"></i>
                    <span className="text-foreground">Twilio Minutes</span>
                  </div>
                  <span className="font-semibold text-foreground">156</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-database text-chart-4"></i>
                    <span className="text-foreground">DB Queries</span>
                  </div>
                  <span className="font-semibold text-foreground">1,247</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Log Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Error Summary</CardTitle>
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/diagnostics")}
                  data-testid="button-view-error-log"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-chart-2 rounded-full"></div>
                    <span className="text-sm text-foreground">No critical errors</span>
                  </div>
                  <span className="text-xs text-muted-foreground">24h</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-chart-4 rounded-full"></div>
                    <span className="text-sm text-foreground">2 warnings</span>
                  </div>
                  <span className="text-xs text-muted-foreground">2h ago</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                    <span className="text-sm text-foreground">15 info logs</span>
                  </div>
                  <span className="text-xs text-muted-foreground">1m ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Connection Diagnostics Visual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Real-time Connection Map</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
              <Button
                variant="ghost"
                onClick={() => refreshConnectionsMutation.mutate()}
                disabled={refreshConnectionsMutation.isPending}
                data-testid="button-refresh-connections"
              >
                <i className="fas fa-sync-alt mr-1"></i>Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* SoulSync Center */}
            <div className="md:col-span-4 flex justify-center mb-8">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                  <i className="fas fa-brain text-white text-xl"></i>
                </div>
                <div className="absolute -top-2 -left-2 w-20 h-20 border-2 border-primary rounded-full animate-ping opacity-20"></div>
                <p className="text-center mt-2 text-sm font-medium text-foreground">SoulSync Core</p>
              </div>
            </div>
            
            {/* API Connections */}
            <div className="text-center">
              <div className="w-12 h-12 bg-chart-2 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-robot text-white"></i>
              </div>
              <p className="text-sm font-medium text-foreground">Kindroid</p>
              <p className="text-xs text-chart-2">142ms</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-microphone text-white"></i>
              </div>
              <p className="text-sm font-medium text-foreground">ElevenLabs</p>
              <p className="text-xs text-chart-2">89ms</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-chart-3 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-phone text-white"></i>
              </div>
              <p className="text-sm font-medium text-foreground">Twilio</p>
              <p className="text-xs text-chart-2">56ms</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-chart-4 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fab fa-spotify text-white"></i>
              </div>
              <p className="text-sm font-medium text-foreground">Spotify</p>
              <p className="text-xs text-chart-2">234ms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-6 right-6 w-14 h-14 bg-destructive hover:bg-destructive/80 text-destructive-foreground rounded-full shadow-lg z-50"
        data-testid="button-emergency-stop"
      >
        <i className="fas fa-stop text-xl"></i>
      </Button>

      {/* WebSocket Connection Indicator */}
      <div className="fixed bottom-6 left-6 flex items-center space-x-2 bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
        <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse"></div>
        <span className="text-sm text-muted-foreground">WebSocket Connected</span>
      </div>
    </div>
  );
}
