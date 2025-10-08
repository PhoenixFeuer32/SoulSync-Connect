import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRealTimeData } from "@/hooks/use-real-time-data";

export default function CallInterface() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();
  const { callStatus } = useRealTimeData();

  const { data: companions } = useQuery({
    queryKey: ["/api/companions"],
  });

  const startCallMutation = useMutation({
    mutationFn: async (companionId: string) => {
      const response = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to prepare for call");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPhoneNumber(data.phoneNumber);
      setIsCallActive(true);
      toast({
        title: "Ready for Calls",
        description: `Call ${data.phoneNumber} to connect with ${data.companionName}`,
        duration: 10000,
      });
    },
  });

  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const response = await fetch(`/api/calls/${callId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: callDuration }),
      });
      if (!response.ok) throw new Error("Failed to end call");
      return response.json();
    },
    onSuccess: () => {
      setIsCallActive(false);
      setCallDuration(0);
      toast({
        title: "Call Ended",
        description: "Call completed successfully",
      });
    },
  });

  const activeCompanion = companions?.find((c: any) => c.isActive);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Call Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Call Interface
            <div className={`px-3 py-1 rounded-full text-sm ${
              isCallActive ? 'bg-chart-2 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {isCallActive ? 'Connected' : 'Disconnected'}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeCompanion ? (
            <div className="text-center">
              {/* Companion Avatar */}
              <div className="relative mx-auto mb-6">
                <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent p-2 ${
                  isCallActive ? 'animate-pulse' : ''
                }`}>
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                    <i className="fas fa-robot text-white text-4xl"></i>
                  </div>
                </div>
                {isCallActive && (
                  <div className="absolute -top-2 -left-2 w-36 h-36 border-4 border-chart-2 rounded-full animate-ping opacity-30"></div>
                )}
              </div>

              <h3 className="text-2xl font-bold mb-2">{activeCompanion.name}</h3>
              <p className="text-muted-foreground mb-6">{activeCompanion.description}</p>

              {/* Phone Number Display */}
              {isCallActive && phoneNumber && (
                <div className="mb-6 max-w-md mx-auto bg-primary/10 border-2 border-primary rounded-lg p-4">
                  <Label className="text-sm font-medium mb-2 block">Call This Number:</Label>
                  <div className="text-3xl font-bold text-primary mb-2">{phoneNumber}</div>
                  <p className="text-sm text-muted-foreground">
                    Dial from your phone to connect with {activeCompanion.name}
                  </p>
                </div>
              )}

              {/* Call Duration */}
              {isCallActive && (
                <div className="text-3xl font-mono font-bold text-chart-2 mb-6">
                  {formatDuration(callDuration)}
                </div>
              )}

              {/* Audio Visualization */}
              {isCallActive && (
                <div className="flex justify-center items-end space-x-1 mb-6 h-16">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-chart-2 w-2 rounded-t animate-pulse"
                      style={{
                        height: `${Math.random() * 60 + 10}px`,
                        animationDelay: `${i * 0.1}s`
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Call Controls */}
              <div className="flex justify-center space-x-4">
                {!isCallActive ? (
                  <Button
                    onClick={() => startCallMutation.mutate(activeCompanion.id)}
                    disabled={startCallMutation.isPending}
                    className="bg-chart-2 hover:bg-chart-2/80 text-white px-8 py-4 text-lg"
                    data-testid="button-start-call"
                  >
                    <i className="fas fa-phone-volume mr-2"></i>
                    {startCallMutation.isPending ? "Activating..." : "Activate for Incoming Calls"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant={isMuted ? "destructive" : "secondary"}
                      onClick={() => setIsMuted(!isMuted)}
                      className="px-6 py-4"
                      data-testid="button-mute"
                    >
                      <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={() => endCallMutation.mutate('current-call')}
                      disabled={endCallMutation.isPending}
                      className="px-8 py-4 text-lg"
                      data-testid="button-end-call"
                    >
                      <i className="fas fa-phone-slash mr-2"></i>
                      End Call
                    </Button>
                    
                    <Button
                      variant="secondary"
                      className="px-6 py-4"
                      data-testid="button-speaker"
                    >
                      <i className="fas fa-volume-up text-lg"></i>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-robot text-6xl text-muted-foreground mb-4"></i>
              <h3 className="text-xl font-semibold mb-2">No Active Companion</h3>
              <p className="text-muted-foreground mb-4">
                Please select or create a companion to start a call
              </p>
              <Button onClick={() => window.location.href = '/companions'}>
                Go to Companions
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Quality & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Call Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Audio Quality:</span>
                <span className="text-chart-2 font-semibold">HD</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="text-chart-2 font-semibold">56ms</span>
              </div>
              <div className="flex justify-between">
                <span>Packet Loss:</span>
                <span className="text-chart-2 font-semibold">0%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Voice Provider:</span>
                <span className="text-foreground">ElevenLabs</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Voice Model:</span>
                <span className="text-foreground">Sophia</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Speed:</span>
                <span className="text-foreground">1.0x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Session ID:</span>
                <span className="text-foreground font-mono text-sm">
                  {isCallActive ? 'CALL_' + Date.now().toString().slice(-6) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Started:</span>
                <span className="text-foreground">
                  {isCallActive ? new Date().toLocaleTimeString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Region:</span>
                <span className="text-foreground">US-East</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-phone text-4xl mb-4"></i>
            <p>No recent calls to display</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
