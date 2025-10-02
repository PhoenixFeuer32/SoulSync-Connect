import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Companion } from "@shared/schema";

interface CompanionCardProps {
  companion: Companion;
  isActive?: boolean;
  onActivate?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onTestVoice?: (id: string) => void;
  onStartCall?: (id: string) => void;
  isLoading?: boolean;
}

export default function CompanionCard({
  companion,
  isActive = false,
  onActivate,
  onEdit,
  onDelete,
  onTestVoice,
  onStartCall,
  isLoading = false
}: CompanionCardProps) {
  
  const getVoiceProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'elevenlabs': return 'fas fa-microphone';
      case 'azure': return 'fab fa-microsoft';
      case 'google': return 'fab fa-google';
      default: return 'fas fa-volume-up';
    }
  };

  const getVoiceProviderColor = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'elevenlabs': return 'text-accent';
      case 'azure': return 'text-blue-500';
      case 'google': return 'text-chart-4';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className={cn(
      "relative transition-all hover:shadow-lg",
      isActive && "ring-2 ring-primary shadow-lg"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {/* Companion Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <i className="fas fa-robot text-white text-lg"></i>
              </div>
              {isActive && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-chart-2 rounded-full border-2 border-card flex items-center justify-center">
                  <i className="fas fa-check text-xs text-white"></i>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center space-x-2">
                <span>{companion.name}</span>
                {isActive && (
                  <Badge variant="default" className="bg-chart-2 text-white">
                    Active
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Created {new Date(companion.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(companion.id)}
              className="text-muted-foreground hover:text-foreground"
              data-testid={`button-edit-${companion.id}`}
            >
              <i className="fas fa-edit text-sm"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete?.(companion.id)}
              className="text-muted-foreground hover:text-destructive"
              data-testid={`button-delete-${companion.id}`}
            >
              <i className="fas fa-trash text-sm"></i>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <p className="text-muted-foreground text-sm line-clamp-2">
            {companion.description || "No description provided"}
          </p>
        </div>

        {/* Personality Traits */}
        {companion.personality && (
          <div>
            <h5 className="text-sm font-medium mb-2">Personality</h5>
            <div className="flex flex-wrap gap-1">
              {typeof companion.personality === 'string' 
                ? companion.personality.split(',').slice(0, 3).map((trait, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {trait.trim()}
                    </Badge>
                  ))
                : Object.entries(companion.personality as Record<string, any>).slice(0, 3).map(([key, value], index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {key}: {String(value)}
                    </Badge>
                  ))
              }
            </div>
          </div>
        )}

        {/* Voice Configuration */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <i className={cn(
              getVoiceProviderIcon(companion.voiceProvider || 'elevenlabs'),
              getVoiceProviderColor(companion.voiceProvider || 'elevenlabs')
            )}></i>
            <span className="text-sm capitalize">
              {companion.voiceProvider || 'ElevenLabs'}
            </span>
          </div>
          
          {companion.voiceId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTestVoice?.(companion.id)}
              disabled={isLoading}
              className="text-xs"
              data-testid={`button-test-voice-${companion.id}`}
            >
              <i className="fas fa-play mr-1"></i>
              Test Voice
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          {!isActive ? (
            <Button
              onClick={() => onActivate?.(companion.id)}
              disabled={isLoading}
              className="flex-1"
              data-testid={`button-activate-${companion.id}`}
            >
              <i className="fas fa-power-off mr-2"></i>
              Activate
            </Button>
          ) : (
            <Button
              onClick={() => onStartCall?.(companion.id)}
              disabled={isLoading}
              className="flex-1 bg-chart-2 hover:bg-chart-2/80"
              data-testid={`button-call-${companion.id}`}
            >
              <i className="fas fa-phone mr-2"></i>
              Call Now
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit?.(companion.id)}
            className="px-3"
            data-testid={`button-configure-${companion.id}`}
          >
            <i className="fas fa-cog"></i>
          </Button>
        </div>

        {/* Status Information */}
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={cn(
              "font-medium",
              isActive ? "text-chart-2" : "text-muted-foreground"
            )}>
              {isActive ? "Ready" : "Inactive"}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>API:</span>
            <span className={cn(
              "font-medium",
              companion.kindroidApiKey ? "text-chart-2" : "text-chart-4"
            )}>
              {companion.kindroidApiKey ? "Connected" : "Needs Setup"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
