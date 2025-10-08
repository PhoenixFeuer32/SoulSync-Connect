import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  icon: string;
  color: string;
}

export default function SetupGuide() {
  const [, setLocation] = useLocation();
  const [expandedStep, setExpandedStep] = useState<string | null>("kindroid");

  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard"],
  });

  const { data: credentials } = useQuery({
    queryKey: ["/api/credentials"],
  });

  const setupSteps: SetupStep[] = [
    {
      id: "kindroid",
      title: "1. Kindroid API Setup",
      description: "Configure your Kindroid companion for voice interactions",
      completed: !!credentials?.find((c: any) => c.service === 'kindroid'),
      required: true,
      icon: "fas fa-robot",
      color: "primary"
    },
    {
      id: "elevenlabs",
      title: "2. ElevenLabs Voice Setup",
      description: "Configure text-to-speech with affordable voice options",
      completed: !!credentials?.find((c: any) => c.service === 'elevenlabs'),
      required: true,
      icon: "fas fa-microphone",
      color: "accent"
    },
    {
      id: "twilio",
      title: "3. Twilio Voice & SMS Setup",
      description: "Enable calling functionality and SMS management",
      completed: !!credentials?.find((c: any) => c.service === 'twilio'),
      required: true,
      icon: "fas fa-phone",
      color: "chart-3"
    },
    {
      id: "companion",
      title: "4. Create Your First Companion",
      description: "Set up an AI companion with personality and voice",
      completed: dashboardData?.companions?.length > 0,
      required: true,
      icon: "fas fa-plus",
      color: "chart-2"
    },
    {
      id: "spotify",
      title: "5. Spotify Integration",
      description: "Share music with your companions during conversations",
      completed: !!credentials?.find((c: any) => c.service === 'spotify'),
      required: false,
      icon: "fab fa-spotify",
      color: "chart-4"
    }
  ];

  const completedSteps = setupSteps.filter(step => step.completed).length;
  const totalSteps = setupSteps.length;
  const progress = (completedSteps / totalSteps) * 100;

  const requiredSteps = setupSteps.filter(step => step.required);
  const completedRequiredSteps = requiredSteps.filter(step => step.completed).length;
  const isSetupComplete = completedRequiredSteps === requiredSteps.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Setup Guide</h1>
        <p className="text-muted-foreground mb-6">
          Step-by-step configuration instructions for SoulSync Connect
        </p>
        
        {/* Progress */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm mb-2">
            <span>Setup Progress</span>
            <span>{completedSteps} of {totalSteps} complete</span>
          </div>
          <Progress value={progress} className="h-3" />
          
          {isSetupComplete && (
            <div className="mt-4 p-4 bg-chart-2/10 border border-chart-2 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <i className="fas fa-check-circle text-chart-2"></i>
                <span className="text-chart-2 font-medium">Setup Complete!</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                All required steps are configured. You're ready to start using SoulSync Connect!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Setup Steps */}
      <div className="max-w-4xl mx-auto space-y-4">
        {setupSteps.map((step) => (
          <Card key={step.id} className={`${step.completed ? 'border-chart-2' : ''}`}>
            <Collapsible
              open={expandedStep === step.id}
              onOpenChange={(open) => setExpandedStep(open ? step.id : null)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full bg-${step.color} flex items-center justify-center`}>
                        <i className={`${step.icon} text-white`}></i>
                      </div>
                      <div className="text-left">
                        <CardTitle className="flex items-center space-x-2">
                          <span>{step.title}</span>
                          {step.required && (
                            <span className="text-xs bg-destructive text-white px-2 py-1 rounded">
                              Required
                            </span>
                          )}
                          {step.completed && (
                            <i className="fas fa-check-circle text-chart-2"></i>
                          )}
                        </CardTitle>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    <i className={`fas fa-chevron-${expandedStep === step.id ? 'up' : 'down'} text-muted-foreground`}></i>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="pl-16">
                    {step.id === 'kindroid' && (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">What is Kindroid?</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Kindroid provides AI companions with personality and memory. It's the brain behind your AI companion conversations.
                          </p>
                          <div className="space-y-2 text-sm">
                            <p><strong>Cost:</strong> Free tier available, premium plans from $9.99/month</p>
                            <p><strong>Features:</strong> Persistent memory, customizable personalities, conversation history</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Visit <a href="https://kindroid.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">kindroid.ai</a> and create an account</li>
                            <li>Navigate to your account settings or API section</li>
                            <li>Generate a new API key</li>
                            <li>Copy the API key and paste it in the API Credentials section</li>
                            <li>Test the connection to verify it's working</li>
                          </ol>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setLocation("/api-credentials")}
                            className={`${step.completed ? 'bg-chart-2' : 'bg-primary'} hover:opacity-80`}
                            data-testid="button-setup-kindroid"
                          >
                            {step.completed ? 'Update Credentials' : 'Add Kindroid API Key'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.open('https://kindroid.ai', '_blank')}
                            data-testid="button-visit-kindroid"
                          >
                            <i className="fas fa-external-link-alt mr-2"></i>
                            Visit Kindroid
                          </Button>
                        </div>
                      </div>
                    )}

                    {step.id === 'elevenlabs' && (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">What is ElevenLabs?</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            ElevenLabs provides high-quality text-to-speech AI voices. It gives your companion a realistic voice for phone calls.
                          </p>
                          <div className="space-y-2 text-sm">
                            <p><strong>Cost:</strong> Free tier with 10,000 characters/month, paid plans from $5/month</p>
                            <p><strong>Features:</strong> Premium AI voices, voice cloning, multiple languages</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Sign up at <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">elevenlabs.io</a></li>
                            <li>Go to your Profile & API section</li>
                            <li>Copy your API key</li>
                            <li>Add it to SoulSync Connect in API Credentials</li>
                            <li>Choose voice models for your companions</li>
                          </ol>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setLocation("/api-credentials")}
                            className={`${step.completed ? 'bg-chart-2' : 'bg-primary'} hover:opacity-80`}
                            data-testid="button-setup-elevenlabs"
                          >
                            {step.completed ? 'Update Credentials' : 'Add ElevenLabs API Key'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.open('https://elevenlabs.io', '_blank')}
                            data-testid="button-visit-elevenlabs"
                          >
                            <i className="fas fa-external-link-alt mr-2"></i>
                            Visit ElevenLabs
                          </Button>
                        </div>
                      </div>
                    )}

                    {step.id === 'twilio' && (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">What is Twilio?</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Twilio handles the actual phone calls and SMS messaging. It's what connects your companion to the phone network.
                          </p>
                          <div className="space-y-2 text-sm">
                            <p><strong>Cost:</strong> Pay-per-use, calls ~$0.013/minute, SMS ~$0.0075/message</p>
                            <p><strong>Features:</strong> Global phone numbers, high-quality voice calls, SMS</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Create account at <a href="https://twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">twilio.com</a></li>
                            <li>Purchase a phone number from your Console</li>
                            <li>Find your Account SID and Auth Token in Console Dashboard</li>
                            <li>Add both credentials to SoulSync Connect</li>
                            <li>Configure webhook URLs for call status updates</li>
                          </ol>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setLocation("/api-credentials")}
                            className={`${step.completed ? 'bg-chart-2' : 'bg-primary'} hover:opacity-80`}
                            data-testid="button-setup-twilio"
                          >
                            {step.completed ? 'Update Credentials' : 'Add Twilio Credentials'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.open('https://twilio.com', '_blank')}
                            data-testid="button-visit-twilio"
                          >
                            <i className="fas fa-external-link-alt mr-2"></i>
                            Visit Twilio
                          </Button>
                        </div>
                      </div>
                    )}

                    {step.id === 'companion' && (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Create Your AI Companion</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Design the personality, voice, and characteristics of your AI companion.
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Go to the Companions section</li>
                            <li>Click "Add Companion" to create your first AI</li>
                            <li>Give your companion a name and description</li>
                            <li>Define personality traits (friendly, helpful, creative, etc.)</li>
                            <li>Select a voice from ElevenLabs</li>
                            <li>Activate your companion for calls</li>
                          </ol>
                        </div>
                        
                        <Button
                          onClick={() => setLocation("/companions")}
                          className={`${step.completed ? 'bg-chart-2' : 'bg-primary'} hover:opacity-80`}
                          data-testid="button-setup-companion"
                        >
                          {step.completed ? 'Manage Companions' : 'Create Your First Companion'}
                        </Button>
                      </div>
                    )}

                    {step.id === 'spotify' && (
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Spotify Integration (Optional)</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Share music with your companions and create shared listening experiences during calls.
                          </p>
                          <div className="space-y-2 text-sm">
                            <p><strong>Cost:</strong> Requires Spotify Premium account</p>
                            <p><strong>Features:</strong> Music sharing, playlist creation, listening together</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold">Setup Instructions:</h4>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Create a Spotify Developer account at <a href="https://developer.spotify.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">developer.spotify.com</a></li>
                            <li>Create a new app in your Spotify Dashboard</li>
                            <li>Copy your Client ID and Client Secret</li>
                            <li>Add both to SoulSync Connect in API Credentials</li>
                            <li>Test the connection and start sharing music!</li>
                          </ol>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setLocation("/api-credentials")}
                            className={`${step.completed ? 'bg-chart-2' : 'bg-primary'} hover:opacity-80`}
                            data-testid="button-setup-spotify"
                          >
                            {step.completed ? 'Update Credentials' : 'Add Spotify Credentials'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.open('https://developer.spotify.com', '_blank')}
                            data-testid="button-visit-spotify-dev"
                          >
                            <i className="fas fa-external-link-alt mr-2"></i>
                            Spotify Developers
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Quick Start Actions */}
      {isSetupComplete && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">🎉 You're All Set!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Your SoulSync Connect is fully configured. Here's what you can do next:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => setLocation("/call-interface")}
                  className="bg-chart-2 hover:bg-chart-2/80 w-full"
                  data-testid="button-start-first-call"
                >
                  <i className="fas fa-phone mr-2"></i>
                  Start Your First Call
                </Button>
                
                <Button
                  onClick={() => setLocation("/file-sharing")}
                  variant="outline"
                  className="w-full"
                  data-testid="button-share-files"
                >
                  <i className="fas fa-share mr-2"></i>
                  Share Files
                </Button>
                
                <Button
                  onClick={() => setLocation("/spotify-integration")}
                  variant="outline"
                  className="w-full"
                  data-testid="button-share-music"
                >
                  <i className="fab fa-spotify mr-2"></i>
                  Share Music
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Troubleshooting */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Common Issues</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">API Connection Failed</p>
                  <p className="text-muted-foreground">Double-check your API keys and ensure they're correctly copied without extra spaces.</p>
                </div>
                
                <div>
                  <p className="font-medium">Voice Not Working</p>
                  <p className="text-muted-foreground">Verify your ElevenLabs account has sufficient credits and the voice ID is valid.</p>
                </div>
                
                <div>
                  <p className="font-medium">Calls Not Connecting</p>
                  <p className="text-muted-foreground">Check your Twilio account balance and ensure webhook URLs are properly configured.</p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Getting Help</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Diagnostics Panel</p>
                  <p className="text-muted-foreground">Check the Diagnostics section for real-time system health and error logs.</p>
                </div>
                
                <div>
                  <p className="font-medium">Test Connections</p>
                  <p className="text-muted-foreground">Use the "Test Connection" buttons in API Credentials to verify each service.</p>
                </div>
                
                <div>
                  <p className="font-medium">Documentation</p>
                  <p className="text-muted-foreground">Refer to each service's official documentation for detailed API setup instructions.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
