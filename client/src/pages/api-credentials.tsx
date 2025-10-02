import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";

interface CredentialForm {
  service: string;
  key: string;
  secret?: string;
  phonenumber?: string;
}

const serviceConfigs = {
  kindroid: {
    name: "Kindroid API",
    icon: "fas fa-robot",
    color: "primary",
    fields: [
      { name: "key", label: "API Key", type: "password", required: true }
    ]
  },
  elevenlabs: {
    name: "ElevenLabs",
    icon: "fas fa-microphone",
    color: "accent",
    fields: [
      { name: "key", label: "API Key", type: "password", required: true }
    ]
  },
  twilio: {
    name: "Twilio",
    icon: "fas fa-phone",
    color: "chart-3",
    fields: [
      { name: "key", label: "Account SID", type: "text", required: true },
      { name: "secret", label: "Auth Token", type: "password", required: true },
      { name: "phonenumber", label: "Phone Number", type: "text", required: true }
    ]
  },
  spotify: {
    name: "Spotify",
    icon: "fab fa-spotify",
    color: "chart-4",
    fields: [
      { name: "key", label: "Client ID", type: "text", required: true },
      { name: "secret", label: "Client Secret", type: "password", required: true }
    ]
  }
};

export default function ApiCredentials() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CredentialForm>();

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["/api/credentials"],
  });

  const saveCredentialMutation = useMutation({
    mutationFn: async (data: CredentialForm) => {
      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save credentials");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      setIsDialogOpen(false);
      reset();
      setSelectedService("");
      toast({
        title: "Credentials Saved",
        description: "API credentials have been encrypted and stored securely",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testCredentialMutation = useMutation({
    mutationFn: async (service: string) => {
      const response = await fetch(`/api/credentials/test/${service}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Test failed");
      return response.json();
    },
    onSuccess: (data, service) => {
      toast({
        title: "Connection Successful",
        description: `${serviceConfigs[service as keyof typeof serviceConfigs].name} API is working correctly`,
      });
    },
    onError: (error, service) => {
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${serviceConfigs[service as keyof typeof serviceConfigs].name}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CredentialForm) => {
    saveCredentialMutation.mutate({
      ...data,
      service: selectedService
    });
  };

  const getCredentialStatus = (service: string) => {
    return credentials?.find((cred: any) => cred.service === service);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Credentials</h1>
          <p className="text-muted-foreground">Configure your third-party service connections</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/80" data-testid="button-add-credential">
              <i className="fas fa-plus mr-2"></i>
              Add Credentials
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add API Credentials</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="service">Service</Label>
                <Select value={selectedService} onValueChange={(value) => {
                  setSelectedService(value);
                  setValue("service", value);
                }}>
                  <SelectTrigger data-testid="select-service">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(serviceConfigs).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center space-x-2">
                          <i className={config.icon}></i>
                          <span>{config.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && serviceConfigs[selectedService as keyof typeof serviceConfigs]?.fields.map((field) => (
                <div key={field.name}>
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    type={field.type}
                    {...register(field.name as keyof CredentialForm, { 
                      required: field.required ? `${field.label} is required` : false 
                    })}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    data-testid={`input-${field.name}`}
                  />
                  {errors[field.name as keyof CredentialForm] && (
                    <p className="text-sm text-destructive mt-1">
                      {errors[field.name as keyof CredentialForm]?.message}
                    </p>
                  )}
                </div>
              ))}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedService("");
                    reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveCredentialMutation.isPending || !selectedService}
                  data-testid="button-save-credential"
                >
                  {saveCredentialMutation.isPending ? "Saving..." : "Save Securely"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(serviceConfigs).map(([key, config]) => {
          const credential = getCredentialStatus(key);
          const isConfigured = !!credential;
          
          return (
            <Card key={key} className={`relative ${isConfigured ? 'ring-2 ring-chart-2' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg bg-${config.color} flex items-center justify-center`}>
                      <i className={`${config.icon} text-white text-xl`}></i>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          isConfigured ? 'bg-chart-2' : 'bg-muted-foreground'
                        }`}></div>
                        <span className="text-sm text-muted-foreground">
                          {isConfigured ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isConfigured && (
                    <span className="text-xs bg-chart-2 text-white px-2 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isConfigured ? (
                  <div className="space-y-4">
                    <div className="text-sm space-y-2">
                      {config.fields.map((field) => (
                        <div key={field.name} className="flex justify-between">
                          <span className="text-muted-foreground">{field.label}:</span>
                          <span className="font-mono text-xs">
                            {credential[`encrypted${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`] || '***'}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Added:</span>
                        <span>{new Date(credential.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => testCredentialMutation.mutate(key)}
                        disabled={testCredentialMutation.isPending}
                        className="flex-1"
                        data-testid={`button-test-${key}`}
                      >
                        <i className="fas fa-plug mr-2"></i>
                        Test Connection
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedService(key);
                          setIsDialogOpen(true);
                        }}
                        data-testid={`button-update-${key}`}
                      >
                        <i className="fas fa-edit"></i>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">
                      No credentials configured for {config.name}
                    </p>
                    <Button
                      onClick={() => {
                        setSelectedService(key);
                        setIsDialogOpen(true);
                      }}
                      className="w-full"
                      data-testid={`button-configure-${key}`}
                    >
                      <i className="fas fa-plus mr-2"></i>
                      Configure {config.name}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Security Information */}
      <Card className="border-chart-4">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <i className="fas fa-shield-alt text-chart-4"></i>
            <span>API Key Security</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <i className="fas fa-lock text-chart-2 mt-1"></i>
              <div>
                <p className="font-medium">All API keys are encrypted and stored securely</p>
                <p className="text-muted-foreground">Keys are encrypted using AES-256 encryption before storage</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <i className="fas fa-key text-chart-2 mt-1"></i>
              <div>
                <p className="font-medium">Keys are never transmitted in plain text</p>
                <p className="text-muted-foreground">All communication uses secure HTTPS connections</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <i className="fas fa-history text-chart-2 mt-1"></i>
              <div>
                <p className="font-medium">Regular security audits are performed</p>
                <p className="text-muted-foreground">You can revoke access at any time by updating your credentials</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <i className="fas fa-eye-slash text-chart-2 mt-1"></i>
              <div>
                <p className="font-medium">You can revoke access at any time</p>
                <p className="text-muted-foreground">Simply delete credentials from your service provider dashboards</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
