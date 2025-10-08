import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useRealTimeData } from "@/hooks/use-real-time-data";

interface SmsCommand {
  id: string;
  phonenumber: string;
  command: string;
  response?: string;
  status: 'received' | 'processed' | 'failed';
  timestamp: string;
}

interface SmsSettings {
  phonenumber: string;
  enableBotControl: boolean;
  autoRespond: boolean;
  allowedCommands: string[];
  securityCode?: string;
}

const AVAILABLE_COMMANDS = [
  { command: 'bot sarah', description: 'Switch to Sarah companion' },
  { command: 'voice rachel', description: 'Change to Rachel voice' },
  { command: 'call start', description: 'Start a call' },
  { command: 'status', description: 'Get current setup' },
  { command: 'help', description: 'List available commands' }
];

export default function SmsManagement() {
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false);
  const [newCommand, setNewCommand] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const { toast } = useToast();

  const { data: smsCommands, isLoading } = useQuery({
    queryKey: ["/api/sms/commands"],
  });

  const { data: smsSettings } = useQuery({
    queryKey: ["/api/sms/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<SmsSettings>) => {
      const response = await fetch("/api/sms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/settings"] });
      toast({
        title: "Settings Updated",
        description: "SMS management settings have been updated"
      });
    }
  });

  const testSmsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sms/test", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to send test SMS");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test SMS Sent",
        description: "Check your phone for the test message"
      });
    }
  });

  const setupSmsManagementMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sms/setup", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to setup SMS management");
      return response.json();
    },
    onSuccess: () => {
      setIsSetupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sms/settings"] });
      toast({
        title: "SMS Management Setup",
        description: "SMS bot control has been configured successfully"
      });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed': return 'fas fa-check-circle text-chart-2';
      case 'failed': return 'fas fa-times-circle text-destructive';
      default: return 'fas fa-clock text-chart-4';
    }
  };

  const formatphonenumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const areaCode = cleaned.slice(1, 4);
      const firstThree = cleaned.slice(4, 7);
      const lastFour = cleaned.slice(7);
      return `+1 (${areaCode}) ${firstThree}-${lastFour}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Management</h1>
          <p className="text-muted-foreground">Control your AI companions via text messages</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            smsSettings?.enableBotControl ? 'bg-chart-2' : 'bg-muted-foreground'
          }`}></div>
          <span className="text-sm text-muted-foreground">
            {smsSettings?.enableBotControl ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Setup Card */}
      {!smsSettings?.phonenumber ? (
        <Card>
          <CardContent className="text-center py-12">
            <i className="fas fa-comment-sms text-6xl text-primary mb-4"></i>
            <h3 className="text-xl font-semibold mb-2">Setup SMS Bot Management</h3>
            <p className="text-muted-foreground mb-6">
              Configure your phone number to control companions via text messages
            </p>
            
            <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/80" data-testid="button-setup-sms">
                  <i className="fas fa-cog mr-2"></i>
                  Setup SMS Management
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>SMS Management Setup</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Your Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      data-testid="input-phone-number"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This number will be used for bot control commands
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="security-code">Security Code (Optional)</Label>
                    <Input
                      id="security-code"
                      placeholder="Enter 4-6 digit code"
                      maxLength={6}
                      data-testid="input-security-code"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Required prefix for commands (e.g., "1234 bot sarah")
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="consent"
                      className="rounded"
                      data-testid="checkbox-consent"
                    />
                    <Label htmlFor="consent" className="text-sm">
                      I consent to receiving SMS messages for bot control
                    </Label>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsSetupDialogOpen(false)}
                      data-testid="button-cancel-setup"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => setupSmsManagementMutation.mutate()}
                      disabled={setupSmsManagementMutation.isPending}
                      data-testid="button-confirm-setup"
                    >
                      Setup SMS Management
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Current Setup */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>SMS Bot Management</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testSmsMutation.mutate()}
                      disabled={testSmsMutation.isPending}
                      data-testid="button-test-sms"
                    >
                      <i className="fas fa-paper-plane mr-2"></i>
                      Test SMS
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Your Phone Number:</span>
                    <span className="font-medium">
                      {formatphonenumber(smsSettings.phonenumber)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enable-bot" className="text-base font-medium">
                        Enable Bot Control
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow SMS commands to control companions
                      </p>
                    </div>
                    <Switch
                      id="enable-bot"
                      checked={smsSettings.enableBotControl}
                      onCheckedChange={(enabled) =>
                        updateSettingsMutation.mutate({ enableBotControl: enabled })
                      }
                      data-testid="switch-enable-bot"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-respond" className="text-base font-medium">
                        Auto Respond
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Send confirmation for each command
                      </p>
                    </div>
                    <Switch
                      id="auto-respond"
                      checked={smsSettings.autoRespond}
                      onCheckedChange={(enabled) =>
                        updateSettingsMutation.mutate({ autoRespond: enabled })
                      }
                      data-testid="switch-auto-respond"
                    />
                  </div>

                  {smsSettings.securityCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Security Code:</span>
                      <span className="font-mono text-sm">
                        {smsSettings.securityCode}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Available Commands */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Available Commands</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCommandDialogOpen(true)}
                    data-testid="button-add-command"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Add Command
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {AVAILABLE_COMMANDS.map((cmd, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <code className="text-sm bg-background px-2 py-1 rounded">
                          {smsSettings.securityCode ? `${smsSettings.securityCode} ` : ''}{cmd.command}
                        </code>
                        <p className="text-sm text-muted-foreground mt-1">
                          {cmd.description}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-test-command-${index}`}
                      >
                        <i className="fas fa-play text-xs"></i>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Commands */}
            <Card>
              <CardHeader>
                <CardTitle>Recent SMS Commands</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : smsCommands && smsCommands.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {smsCommands.map((cmd: SmsCommand) => (
                      <div key={cmd.id} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                        <i className={getStatusIcon(cmd.status)}></i>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <code className="text-sm bg-background px-2 py-1 rounded">
                              {cmd.command}
                            </code>
                            <span className="text-xs text-muted-foreground">
                              {new Date(cmd.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {formatphonenumber(cmd.phonenumber)}
                          </p>
                          {cmd.response && (
                            <p className="text-sm text-chart-2 mt-2">
                              Response: {cmd.response}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-comment text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground">No SMS commands yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send a text to start using bot control
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Reference */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Basic Commands:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <code>status</code> - Get current companion info</li>
                      <li>• <code>help</code> - List all available commands</li>
                      <li>• <code>call start</code> - Initiate a call</li>
                      <li>• <code>call end</code> - End current call</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Companion Control:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <code>bot [name]</code> - Switch companion</li>
                      <li>• <code>voice [name]</code> - Change voice</li>
                      <li>• <code>mood [type]</code> - Adjust personality</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Security:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Commands require your registered number</li>
                      <li>• Optional security code prefix</li>
                      <li>• All commands are logged for security</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Add Custom Command Dialog */}
      <Dialog open={isCommandDialogOpen} onOpenChange={setIsCommandDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Command</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="command">Command</Label>
              <Input
                id="command"
                placeholder="e.g., music play"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                data-testid="input-custom-command"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What this command does..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                data-testid="textarea-command-description"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCommandDialogOpen(false);
                  setNewCommand("");
                  setNewDescription("");
                }}
                data-testid="button-cancel-command"
              >
                Cancel
              </Button>
              <Button
                disabled={!newCommand.trim()}
                data-testid="button-save-command"
              >
                Add Command
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
