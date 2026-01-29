import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";

interface CompanionForm {
  name: string;
  description: string;
  personality: string;
  voiceId: string;
  voiceProvider: string;
  kindroidBotId: string;
}

interface Companion {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  voiceId?: string;
  voiceProvider?: string;
  kindroidBotId?: string;
  isActive: boolean;
  createdAt: string;
}

export default function Companions() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompanion, setEditingCompanion] = useState<Companion | null>(null);
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CompanionForm>();

  const { data: companions, isLoading } = useQuery({
    queryKey: ["/api/companions"],
  });

  const createCompanionMutation = useMutation({
    mutationFn: async (data: CompanionForm) => {
      const response = await fetch("/api/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create companion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companions"] });
      setIsDialogOpen(false);
      reset();
      toast({
        title: "Companion Created",
        description: "Your new AI companion has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateCompanionMutation = useMutation({
    mutationFn: async (companionId: string) => {
      const response = await fetch(`/api/companions/${companionId}/activate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to activate companion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companions"] });
      toast({
        title: "Companion Activated",
        description: "Companion is now active and ready for calls",
      });
    },
  });

  const deleteCompanionMutation = useMutation({
    mutationFn: async (companionId: string) => {
      const response = await fetch(`/api/companions/${companionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete companion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companions"] });
      toast({
        title: "Companion Deleted",
        description: "Companion has been removed successfully",
      });
    },
  });

  const updateCompanionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompanionForm }) => {
      const response = await fetch(`/api/companions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update companion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companions"] });
      setIsDialogOpen(false);
      setEditingCompanion(null);
      reset();
      toast({
        title: "Companion Updated",
        description: "Your companion has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanionForm) => {
    if (editingCompanion) {
      updateCompanionMutation.mutate({ id: editingCompanion.id, data });
    } else {
      createCompanionMutation.mutate(data);
    }
  };

  const openEditDialog = (companion: Companion) => {
    setEditingCompanion(companion);
    setValue("name", companion.name);
    setValue("description", companion.description || "");
    setValue("personality", companion.personality || "");
    setValue("voiceId", companion.voiceId || "");
    setValue("voiceProvider", companion.voiceProvider || "elevenlabs");
    setValue("kindroidBotId", companion.kindroidBotId || "");
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCompanion(null);
    reset();
    setIsDialogOpen(true);
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
          <h1 className="text-3xl font-bold">AI Companions</h1>
          <p className="text-muted-foreground">Manage your AI companions and their personalities</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCompanion(null);
            reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/80" onClick={openCreateDialog} data-testid="button-add-companion">
              <i className="fas fa-plus mr-2"></i>
              Add Companion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCompanion ? "Edit Companion" : "Create New Companion"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                  placeholder="Enter companion name"
                  data-testid="input-companion-name"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Describe your companion's role and personality"
                  data-testid="textarea-companion-description"
                />
              </div>

              <div>
                <Label htmlFor="personality">Personality Traits</Label>
                <Textarea
                  id="personality"
                  {...register("personality")}
                  placeholder="Friendly, creative, analytical, humorous..."
                  data-testid="textarea-companion-personality"
                />
              </div>

              <div>
                <Label htmlFor="voiceProvider">Voice Provider</Label>
                <Select defaultValue="elevenlabs">
                  <SelectTrigger data-testid="select-voice-provider">
                    <SelectValue placeholder="Select voice provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    <SelectItem value="azure">Azure Speech</SelectItem>
                    <SelectItem value="google">Google Cloud TTS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="voiceId">Voice ID</Label>
                <Input
                  id="voiceId"
                  {...register("voiceId")}
                  placeholder="Enter voice ID"
                  data-testid="input-voice-id"
                />
              </div>

              <div>
                <Label htmlFor="kindroidBotId">Kindroid Bot ID</Label>
                <Input
                  id="kindroidBotId"
                  {...register("kindroidBotId", { required: "Kindroid Bot ID is required" })}
                  placeholder="Enter Kindroid Bot ID"
                  data-testid="input-kindroid-bot-id"
                />
                {errors.kindroidBotId && (
                  <p className="text-sm text-destructive mt-1">{errors.kindroidBotId.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Get this from your Kindroid dashboard when creating a companion
                </p>
              </div>


              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCompanionMutation.isPending || updateCompanionMutation.isPending}
                  data-testid="button-create-companion"
                >
                  {editingCompanion
                    ? (updateCompanionMutation.isPending ? "Saving..." : "Save Changes")
                    : (createCompanionMutation.isPending ? "Creating..." : "Create Companion")
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Companions Grid */}
      {companions && companions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companions.map((companion: Companion) => (
            <Card key={companion.id} className={`relative ${companion.isActive ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <i className="fas fa-robot text-white"></i>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{companion.name}</CardTitle>
                      {companion.isActive && (
                        <span className="text-xs bg-chart-2 text-white px-2 py-1 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(companion)}
                      className="text-muted-foreground hover:text-primary"
                      data-testid={`button-edit-${companion.id}`}
                    >
                      <i className="fas fa-edit text-sm"></i>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCompanionMutation.mutate(companion.id)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-${companion.id}`}
                    >
                      <i className="fas fa-trash text-sm"></i>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {companion.description || "No description provided"}
                </p>
                
                <div className="space-y-2 text-sm">
                  {companion.kindroidBotId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bot ID:</span>
                      <span className="font-mono text-xs">{companion.kindroidBotId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voice:</span>
                    <span>{companion.voiceProvider || 'ElevenLabs'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(companion.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  {!companion.isActive ? (
                    <Button
                      onClick={() => activateCompanionMutation.mutate(companion.id)}
                      disabled={activateCompanionMutation.isPending}
                      className="flex-1"
                      data-testid={`button-activate-${companion.id}`}
                    >
                      Activate
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled
                      data-testid={`button-active-${companion.id}`}
                    >
                      Active
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`button-test-voice-${companion.id}`}
                  >
                    <i className="fas fa-play"></i>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <i className="fas fa-robot text-6xl text-muted-foreground mb-4"></i>
            <h3 className="text-xl font-semibold mb-2">No Companions Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI companion to start having conversations
            </p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-primary hover:bg-primary/80"
              data-testid="button-create-first-companion"
            >
              <i className="fas fa-plus mr-2"></i>
              Create Your First Companion
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Setup Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-plus text-primary text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">1. Create Companion</h4>
              <p className="text-sm text-muted-foreground">
                Add a new AI companion with Bot ID from Kindroid dashboard
              </p>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-cog text-primary text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">2. Configure Voice</h4>
              <p className="text-sm text-muted-foreground">
                Set up ElevenLabs or other voice providers
              </p>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-phone text-primary text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">3. Start Calling</h4>
              <p className="text-sm text-muted-foreground">
                Activate and begin conversations with your AI
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
