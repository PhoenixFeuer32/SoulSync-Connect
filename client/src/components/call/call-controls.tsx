import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface CallControlsProps {
  isCallActive: boolean;
  isMuted: boolean;
  isOnSpeaker: boolean;
  volume: number;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onVolumeChange: (volume: number) => void;
  callDuration?: number;
  isLoading?: boolean;
}

export default function CallControls({
  isCallActive,
  isMuted,
  isOnSpeaker,
  volume,
  onStartCall,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
  onVolumeChange,
  callDuration = 0,
  isLoading = false
}: CallControlsProps) {
  const [showVolumeControl, setShowVolumeControl] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (!isCallActive) {
    return (
      <div className="flex justify-center">
        <Button
          onClick={onStartCall}
          disabled={isLoading}
          className="bg-chart-2 hover:bg-chart-2/80 text-white px-8 py-4 text-lg rounded-full shadow-lg transform hover:scale-105 transition-all"
          data-testid="button-start-call"
        >
          <i className="fas fa-phone mr-3 text-xl"></i>
          {isLoading ? "Connecting..." : "Start Call"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Call Duration */}
      <div className="text-center">
        <div className="text-4xl font-mono font-bold text-chart-2 mb-2">
          {formatDuration(callDuration)}
        </div>
        <p className="text-sm text-muted-foreground">Call in progress</p>
      </div>

      {/* Main Call Controls */}
      <div className="flex justify-center items-center space-x-6">
        {/* Mute Button */}
        <Button
          onClick={onToggleMute}
          variant={isMuted ? "destructive" : "secondary"}
          className="w-16 h-16 rounded-full shadow-lg transform hover:scale-110 transition-all"
          data-testid="button-mute"
        >
          <i className={cn(
            "text-xl",
            isMuted ? "fas fa-microphone-slash" : "fas fa-microphone"
          )}></i>
        </Button>

        {/* End Call Button */}
        <Button
          onClick={onEndCall}
          variant="destructive"
          className="w-20 h-20 rounded-full shadow-lg transform hover:scale-110 transition-all"
          data-testid="button-end-call"
        >
          <i className="fas fa-phone-slash text-2xl"></i>
        </Button>

        {/* Speaker Button */}
        <Button
          onClick={onToggleSpeaker}
          variant={isOnSpeaker ? "default" : "secondary"}
          className="w-16 h-16 rounded-full shadow-lg transform hover:scale-110 transition-all"
          data-testid="button-speaker"
        >
          <i className={cn(
            "text-xl",
            isOnSpeaker ? "fas fa-volume-up" : "fas fa-volume-down"
          )}></i>
        </Button>
      </div>

      {/* Secondary Controls */}
      <div className="flex justify-center space-x-4">
        {/* Volume Control */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowVolumeControl(!showVolumeControl)}
            className="px-4 py-2"
            data-testid="button-volume-control"
          >
            <i className="fas fa-volume-up mr-2"></i>
            Volume
          </Button>
          
          {showVolumeControl && (
            <Card className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Volume</span>
                    <span>{volume}%</span>
                  </div>
                  <Slider
                    value={[volume]}
                    onValueChange={(value) => onVolumeChange(value[0])}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="slider-volume"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add to Call */}
        <Button
          variant="outline"
          className="px-4 py-2"
          data-testid="button-add-to-call"
        >
          <i className="fas fa-user-plus mr-2"></i>
          Add to Call
        </Button>

        {/* Record Call */}
        <Button
          variant="outline"
          className="px-4 py-2"
          data-testid="button-record-call"
        >
          <i className="fas fa-record-vinyl mr-2"></i>
          Record
        </Button>
      </div>

      {/* Call Status Indicators */}
      <div className="flex justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse"></div>
          <span className="text-muted-foreground">Connected</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
          <span className="text-muted-foreground">HD Quality</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
          <span className="text-muted-foreground">Low Latency</span>
        </div>
      </div>
    </div>
  );
}
