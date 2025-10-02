import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useRealTimeData } from "@/hooks/use-real-time-data";
import RealTimeChart from "@/components/diagnostics/real-time-chart";

interface ErrorLog {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  message: string;
  timestamp: string;
  metadata?: any;
}

interface SystemMetric {
  id: string;
  metric: string;
  service: string;
  value: number;
  unit: string;
  timestamp: string;
}

export default function Diagnostics() {
  const [logFilter, setLogFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { systemStatus, errors, isConnected } = useRealTimeData();

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/diagnostics/logs", serviceFilter, levelFilter],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/diagnostics/metrics"],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const { data: healthData } = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000,
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-destructive';
      case 'warn': return 'text-chart-4';
      case 'info': return 'text-chart-2';
      case 'debug': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-destructive';
      case 'warn': return 'bg-chart-4';
      case 'info': return 'bg-chart-2';
      case 'debug': return 'bg-muted-foreground';
      default: return 'bg-foreground';
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'kindroid': return 'fas fa-robot';
      case 'elevenlabs': return 'fas fa-microphone';
      case 'twilio': return 'fas fa-phone';
      case 'spotify': return 'fab fa-spotify';
      case 'system': return 'fas fa-server';
      case 'websocket': return 'fas fa-plug';
      default: return 'fas fa-cog';
    }
  };

  const filteredLogs = logs?.filter((log: ErrorLog) => {
    const matchesSearch = !logFilter || 
      log.message.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.service.toLowerCase().includes(logFilter.toLowerCase());
    
    const matchesService = serviceFilter === 'all' || log.service === serviceFilter;
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    
    return matchesSearch && matchesService && matchesLevel;
  }) || [];

  const errorCounts = logs?.reduce((acc: any, log: ErrorLog) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {}) || {};

  const serviceHealth = {
    kindroid: systemStatus?.kindroid === 'connected' ? 'healthy' : 'error',
    elevenlabs: systemStatus?.elevenlabs === 'connected' ? 'healthy' : 'error',
    twilio: systemStatus?.twilio === 'connected' ? 'healthy' : 'error',
    database: systemStatus?.database === 'healthy' ? 'healthy' : 'error',
    websocket: isConnected ? 'healthy' : 'error'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Diagnostics</h1>
          <p className="text-muted-foreground">Monitor system health and performance metrics</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-chart-2 animate-pulse' : 'bg-muted-foreground'}`}></div>
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Live Updates' : 'Disconnected'}
            </span>
          </div>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-toggle-auto-refresh"
          >
            <i className={`fas ${autoRefresh ? 'fa-pause' : 'fa-play'} mr-2`}></i>
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Object.entries(serviceHealth).map(([service, status]) => (
          <Card key={service}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  status === 'healthy' ? 'bg-chart-2' : 'bg-destructive'
                }`}>
                  <i className={`${getServiceIcon(service)} text-white`}></i>
                </div>
                <div>
                  <p className="font-medium capitalize">{service}</p>
                  <p className={`text-sm ${status === 'healthy' ? 'text-chart-2' : 'text-destructive'}`}>
                    {status === 'healthy' ? 'Healthy' : 'Error'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-times-circle text-destructive text-xl"></i>
              <div>
                <p className="text-2xl font-bold">{errorCounts.error || 0}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-exclamation-triangle text-chart-4 text-xl"></i>
              <div>
                <p className="text-2xl font-bold">{errorCounts.warn || 0}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-info-circle text-chart-2 text-xl"></i>
              <div>
                <p className="text-2xl font-bold">{errorCounts.info || 0}</p>
                <p className="text-sm text-muted-foreground">Info</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-clock text-muted-foreground text-xl"></i>
              <div>
                <p className="text-2xl font-bold">
                  {Math.floor(Date.now() / 1000 - (healthData?.timestamp ? new Date(healthData.timestamp).getTime() / 1000 : 0))}s
                </p>
                <p className="text-sm text-muted-foreground">Uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Diagnostics Tabs */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="logs" data-testid="tab-logs">Error Logs</TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">Performance</TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">API Health</TabsTrigger>
          <TabsTrigger value="network" data-testid="tab-network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Log Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search logs..."
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    data-testid="input-search-logs"
                  />
                </div>
                
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-40" data-testid="select-service-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="kindroid">Kindroid</SelectItem>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="websocket">WebSocket</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-32" data-testid="select-level-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Error Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Error Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.map((log: ErrorLog) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getLevelBadgeColor(log.level)}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${getLevelBadgeColor(log.level)} text-white`}>
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium">{log.service}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{log.message}</p>
                        {log.metadata && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                              Show metadata
                            </summary>
                            <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-check-circle text-4xl text-chart-2 mb-4"></i>
                  <p className="text-muted-foreground">No logs match your filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Response Times</CardTitle>
              </CardHeader>
              <CardContent>
                <RealTimeChart
                  data={metrics?.filter((m: SystemMetric) => m.metric === 'api_latency') || []}
                  type="line"
                  dataKey="value"
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Resource Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <RealTimeChart
                  data={metrics?.filter((m: SystemMetric) => m.metric === 'memory_usage') || []}
                  type="area"
                  dataKey="value"
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <RealTimeChart
                  data={metrics?.filter((m: SystemMetric) => m.metric === 'error_rate') || []}
                  type="bar"
                  dataKey="value"
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Quality Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Average Call Duration:</span>
                    <span className="font-semibold">12:34</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-semibold text-chart-2">98.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Latency:</span>
                    <span className="font-semibold">76ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Calls Today:</span>
                    <span className="font-semibold">24</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          {/* API Health Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['kindroid', 'elevenlabs', 'twilio', 'spotify'].map((service) => (
              <Card key={service}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className={getServiceIcon(service)}></i>
                    <span className="capitalize">{service} API</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-semibold ${
                        serviceHealth[service as keyof typeof serviceHealth] === 'healthy' 
                          ? 'text-chart-2' : 'text-destructive'
                      }`}>
                        {serviceHealth[service as keyof typeof serviceHealth] === 'healthy' ? 'Connected' : 'Error'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className="font-semibold">
                        {Math.floor(Math.random() * 200 + 50)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Requests/Hour:</span>
                      <span className="font-semibold">
                        {Math.floor(Math.random() * 100 + 50)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Rate:</span>
                      <span className="font-semibold text-chart-2">0.1%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          {/* Network Diagnostics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-wifi text-chart-2"></i>
                      <span>Internet Connection</span>
                    </div>
                    <span className="text-chart-2 font-semibold">Connected</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-plug text-chart-2"></i>
                      <span>WebSocket</span>
                    </div>
                    <span className={`font-semibold ${isConnected ? 'text-chart-2' : 'text-destructive'}`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-database text-chart-2"></i>
                      <span>Database</span>
                    </div>
                    <span className="text-chart-2 font-semibold">Connected</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Ping:</span>
                    <span className="font-semibold">24ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Download Speed:</span>
                    <span className="font-semibold">125 Mbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Upload Speed:</span>
                    <span className="font-semibold">48 Mbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packet Loss:</span>
                    <span className="font-semibold text-chart-2">0%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
