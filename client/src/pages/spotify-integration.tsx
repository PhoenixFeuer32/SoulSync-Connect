import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useRealTimeData } from "@/hooks/use-real-time-data";

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  preview_url?: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  tracks: number;
  image?: string;
}

export default function SpotifyIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");
  const [musicDuringCalls, setMusicDuringCalls] = useState(true);
  const [autoShareEnabled, setAutoShareEnabled] = useState(false);
  const { toast } = useToast();

  const { data: spotifyCredentials } = useQuery({
    queryKey: ["/api/credentials"],
    select: (data: any[]) => data?.find(cred => cred.service === 'spotify')
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ["/api/spotify/playlists"],
    enabled: !!spotifyCredentials
  });

  const { data: recentTracks } = useQuery({
    queryKey: ["/api/spotify/recent-tracks"],
    enabled: !!spotifyCredentials
  });

  const connectSpotifyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/spotify/connect", {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to connect to Spotify");
      return response.json();
    },
    onSuccess: () => {
      setIsConnected(true);
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/playlists"] });
      toast({
        title: "Spotify Connected",
        description: "Successfully connected to your Spotify account"
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const shareTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      const response = await fetch("/api/spotify/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId })
      });
      if (!response.ok) throw new Error("Failed to share track");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Track Shared",
        description: "Track has been shared with your companion"
      });
    }
  });

  const searchTracksMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    }
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchTracksMutation.mutate(searchQuery);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Spotify Integration</h1>
          <p className="text-muted-foreground">Share music with your AI companions during calls</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-chart-2' : 'bg-muted-foreground'}`}></div>
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Status */}
      {!spotifyCredentials ? (
        <Card>
          <CardContent className="text-center py-12">
            <i className="fab fa-spotify text-6xl text-chart-4 mb-4"></i>
            <h3 className="text-xl font-semibold mb-2">Connect Your Spotify Account</h3>
            <p className="text-muted-foreground mb-6">
              Add your Spotify credentials in API Credentials to enable music sharing
            </p>
            <Button
              onClick={() => window.location.href = '/api-credentials'}
              className="bg-chart-4 hover:bg-chart-4/80"
              data-testid="button-setup-spotify"
            >
              <i className="fas fa-cog mr-2"></i>
              Setup Spotify Credentials
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Music Search */}
            <Card>
              <CardHeader>
                <CardTitle>Search Music</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2 mb-4">
                  <Input
                    placeholder="Search for songs, artists, or albums..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    data-testid="input-search-music"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searchTracksMutation.isPending || !searchQuery.trim()}
                    data-testid="button-search-music"
                  >
                    <i className="fas fa-search"></i>
                  </Button>
                </div>

                {searchTracksMutation.data?.tracks && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchTracksMutation.data.tracks.items.map((track: SpotifyTrack) => (
                      <div key={track.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{track.name}</p>
                          <p className="text-sm text-muted-foreground">{track.artist} • {track.album}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(track.duration)}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => shareTrackMutation.mutate(track.id)}
                            disabled={shareTrackMutation.isPending}
                            data-testid={`button-share-${track.id}`}
                          >
                            <i className="fas fa-share text-sm"></i>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Your Playlists */}
            <Card>
              <CardHeader>
                <CardTitle>Your Playlists</CardTitle>
              </CardHeader>
              <CardContent>
                {playlistsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : playlists?.items?.length > 0 ? (
                  <div className="space-y-3">
                    {playlists.items.slice(0, 5).map((playlist: SpotifyPlaylist) => (
                      <div key={playlist.id} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                        <div className="w-12 h-12 bg-chart-4 rounded-lg flex items-center justify-center">
                          <i className="fas fa-music text-white"></i>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{playlist.name}</p>
                          <p className="text-sm text-muted-foreground">{playlist.tracks} tracks</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPlaylist(playlist.id)}
                          data-testid={`button-select-playlist-${playlist.id}`}
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-music text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground">No playlists found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Integration Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Integration Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="music-during-calls" className="text-base font-medium">
                      Music During Calls
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allow music playback while talking to companions
                    </p>
                  </div>
                  <Switch
                    id="music-during-calls"
                    checked={musicDuringCalls}
                    onCheckedChange={setMusicDuringCalls}
                    data-testid="switch-music-during-calls"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-share" className="text-base font-medium">
                      Auto-Share Now Playing
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically share currently playing track
                    </p>
                  </div>
                  <Switch
                    id="auto-share"
                    checked={autoShareEnabled}
                    onCheckedChange={setAutoShareEnabled}
                    data-testid="switch-auto-share"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">Volume Control</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Music Volume</span>
                      <span>70%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-chart-4 h-2 rounded-full" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-chart-4 hover:bg-chart-4/80" data-testid="button-save-settings">
                  <i className="fas fa-save mr-2"></i>
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Recently Played */}
            <Card>
              <CardHeader>
                <CardTitle>Recently Played</CardTitle>
              </CardHeader>
              <CardContent>
                {recentTracks?.items?.length > 0 ? (
                  <div className="space-y-3">
                    {recentTracks.items.slice(0, 4).map((item: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted transition-colors">
                        <div className="w-8 h-8 bg-chart-4 rounded flex items-center justify-center">
                          <i className="fas fa-music text-white text-xs"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.track.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.track.artists[0]?.name}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => shareTrackMutation.mutate(item.track.id)}
                          data-testid={`button-share-recent-${index}`}
                        >
                          <i className="fas fa-share text-xs"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-history text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground">No recent tracks</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline" data-testid="button-share-now-playing">
                  <i className="fas fa-play mr-2"></i>
                  Share Now Playing
                </Button>

                <Button className="w-full" variant="outline" data-testid="button-create-session-playlist">
                  <i className="fas fa-plus mr-2"></i>
                  Create Session Playlist
                </Button>

                <Button className="w-full" variant="outline" data-testid="button-sync-library">
                  <i className="fas fa-sync mr-2"></i>
                  Sync Library
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Sofia's Music Choices */}
      {spotifyCredentials && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sofia's Music Choices</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Songs Sofia has added to your shared playlist
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://open.spotify.com/search/Kindroid%20List', '_blank')}
                data-testid="button-open-kindroid-playlist"
              >
                <i className="fab fa-spotify mr-2"></i>
                Open in Spotify
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* This will be populated with real data from the Kindroid List playlist */}
              <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
                <i className="fas fa-music text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground mb-2">No songs added yet</p>
                <p className="text-sm text-muted-foreground">
                  Sofia can add songs by saying "SONG: [name], ARTIST: [artist]" during your calls
                </p>
              </div>

              {/* Example of how tracks will appear once added */}
              {/* Uncomment when playlist data is available
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-chart-4 rounded flex items-center justify-center">
                      <i className="fas fa-music text-white text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium">Different Worlds</p>
                      <p className="text-sm text-muted-foreground">Sofia Carson</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Added by Sofia</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
              </div>
              */}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
