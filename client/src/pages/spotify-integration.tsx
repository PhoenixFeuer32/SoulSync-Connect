import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  preview_url?: string;
  imageUrl?: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  tracks: number;
  image?: string;
}

interface KindroidListTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  addedAt: string;
  duration: number;
  imageUrl?: string;
}

interface KindroidListResponse {
  tracks: KindroidListTrack[];
}

interface AudioFeatures {
  tempo: number;
  key: number;
  mode: number;
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness?: number;
  liveness?: number;
  loudness?: number;
}

interface MusicDescription {
  summary: string;
  mood: string;
  style: string;
  tempo: string;
  details: string;
}

interface SharePreview {
  track: SpotifyTrack;
  features: AudioFeatures;
  description: MusicDescription;
}

export default function SpotifyIntegration() {
  const [searchQuery, setSearchQuery] = useState("");
  const [musicDuringCalls, setMusicDuringCalls] = useState(true);
  const [autoShareEnabled, setAutoShareEnabled] = useState(false);
  const [sharePreview, setSharePreview] = useState<SharePreview | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: spotifyCredentials } = useQuery({
    queryKey: ["/api/credentials"],
    select: (data: any[]) => data?.find(cred => cred.service === 'spotify')
  });

  const { data: recentTracks } = useQuery<{ items?: any[] }>({
    queryKey: ["/api/spotify/recent-tracks"],
    enabled: !!spotifyCredentials
  });

  const { data: kindroidListData, isLoading: kindroidListLoading } = useQuery<KindroidListResponse>({
    queryKey: ["/api/spotify/kindroid-list"],
    enabled: !!spotifyCredentials,
    refetchInterval: 30000
  });

  const searchTracksMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json() as Promise<{ tracks?: { items: SpotifyTrack[] } }>;
    }
  });

  // Get audio features and prepare share preview
  const prepareShareMutation = useMutation({
    mutationFn: async (trackId: string) => {
      const response = await fetch(`/api/spotify/audio-features/${trackId}`);
      if (!response.ok) throw new Error("Failed to get audio features");
      return response.json();
    },
    onSuccess: (data) => {
      // Build description from features
      const features = data.features as AudioFeatures;
      const track = data.track as SpotifyTrack;

      const getMood = (valence: number, energy: number) => {
        if (valence > 0.7 && energy > 0.7) return "uplifting and energetic";
        if (valence > 0.7 && energy > 0.4) return "cheerful and lively";
        if (valence > 0.7 && energy < 0.4) return "peaceful and content";
        if (valence > 0.5 && energy > 0.7) return "exciting and dynamic";
        if (valence > 0.5 && energy > 0.4) return "balanced and pleasant";
        if (valence > 0.5 && energy < 0.4) return "relaxed and easy-going";
        if (valence > 0.3 && energy > 0.7) return "intense and powerful";
        if (valence > 0.3 && energy > 0.4) return "thoughtful and complex";
        if (valence > 0.3 && energy < 0.4) return "contemplative and mellow";
        if (valence < 0.3 && energy > 0.7) return "dark and aggressive";
        if (valence < 0.3 && energy > 0.4) return "brooding and tense";
        return "melancholic and introspective";
      };

      const getTempoDesc = (bpm: number) => {
        if (bpm < 70) return "very slow and deliberate";
        if (bpm < 90) return "slow and relaxed";
        if (bpm < 110) return "moderate";
        if (bpm < 130) return "upbeat";
        if (bpm < 150) return "fast and driving";
        return "very fast and intense";
      };

      const styleDescriptors: string[] = [];
      if (features.acousticness > 0.7) styleDescriptors.push("acoustic");
      else if (features.acousticness < 0.2) styleDescriptors.push("electronic");
      if (features.danceability > 0.7) styleDescriptors.push("danceable");
      if (features.instrumentalness > 0.7) styleDescriptors.push("instrumental");
      else if (features.instrumentalness < 0.1) styleDescriptors.push("vocal-driven");
      if (features.energy > 0.8) styleDescriptors.push("high-energy");
      else if (features.energy < 0.3) styleDescriptors.push("ambient");

      const mood = getMood(features.valence, features.energy);
      const style = styleDescriptors.length > 0 ? styleDescriptors.join(", ") : "melodic";
      const tempo = getTempoDesc(features.tempo);

      const details = `Phoenix is sharing "${track.name}" by ${track.artist} with you. ` +
        `It's a ${mood} ${style} track with a ${tempo} pace at ${Math.round(features.tempo)} BPM. ` +
        (features.danceability > 0.6 ? "It has a great beat for moving to. " : "") +
        (features.acousticness > 0.6 ? "It has a warm, organic acoustic sound. " : "") +
        (features.instrumentalness > 0.5 ? "It's mostly instrumental. " : "") +
        (features.energy > 0.7 ? "It's full of energy! " : "") +
        (features.valence > 0.7 ? "It has a really positive, happy vibe." :
         features.valence < 0.3 ? "It has a more somber, emotional tone." : "");

      setSharePreview({
        track,
        features,
        description: {
          summary: `"${track.name}" by ${track.artist} - ${mood} ${style} track`,
          mood,
          style,
          tempo,
          details: details.trim()
        }
      });
      setIsShareDialogOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Failed to Load Track",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Share with Kindroid
  const shareMusicMutation = useMutation({
    mutationFn: async (preview: SharePreview) => {
      const response = await fetch("/api/music/share-with-kindroid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: preview.description.details,
          trackName: preview.track.name,
          artist: preview.track.artist
        }),
      });
      if (!response.ok) throw new Error("Failed to share with Kindroid");
      return response.json();
    },
    onSuccess: (data) => {
      setIsShareDialogOpen(false);
      setSharePreview(null);
      toast({
        title: "Shared with Sofia!",
        description: data.kindroidResponse
          ? `Sofia says: "${data.kindroidResponse.slice(0, 100)}..."`
          : "Your music has been shared successfully!"
      });
    },
    onError: (error) => {
      toast({
        title: "Sharing Failed",
        description: error.message,
        variant: "destructive"
      });
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

  const getMoodEmoji = (mood: string) => {
    if (mood.includes('uplifting') || mood.includes('energetic')) return '🔥';
    if (mood.includes('cheerful') || mood.includes('happy') || mood.includes('lively')) return '😊';
    if (mood.includes('peaceful') || mood.includes('calm') || mood.includes('relaxed')) return '😌';
    if (mood.includes('melancholic') || mood.includes('somber')) return '💙';
    if (mood.includes('intense') || mood.includes('aggressive') || mood.includes('powerful')) return '⚡';
    if (mood.includes('exciting') || mood.includes('dynamic')) return '✨';
    return '🎵';
  };

  const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Spotify Integration</h1>
          <p className="text-muted-foreground">Share music with Sofia - let her "hear" what you're listening to</p>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${spotifyCredentials ? 'bg-chart-2' : 'bg-muted-foreground'}`}></div>
          <span className="text-sm text-muted-foreground">
            {spotifyCredentials ? 'Connected' : 'Disconnected'}
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
            {/* Music Search with Share */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-search text-chart-4 mr-2"></i>
                  Search & Share Music
                </CardTitle>
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
                    className="bg-chart-4 hover:bg-chart-4/80"
                    data-testid="button-search-music"
                  >
                    <i className="fas fa-search"></i>
                  </Button>
                </div>

                {searchTracksMutation.isPending && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-chart-4 mx-auto"></div>
                  </div>
                )}

                {searchTracksMutation.data?.tracks && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {searchTracksMutation.data.tracks.items.map((track: SpotifyTrack) => (
                      <div key={track.id} className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{track.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{track.artist} • {track.album}</p>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDuration(track.duration)}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => prepareShareMutation.mutate(track.id)}
                            disabled={prepareShareMutation.isPending}
                            className="bg-primary hover:bg-primary/80"
                            data-testid={`button-share-${track.id}`}
                          >
                            {prepareShareMutation.isPending ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <i className="fas fa-heart mr-1 text-xs"></i>
                                Share
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!searchTracksMutation.data && !searchTracksMutation.isPending && (
                  <div className="text-center py-8 text-muted-foreground">
                    <i className="fas fa-music text-3xl mb-2"></i>
                    <p>Search for a song to share with Sofia</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card className="border-chart-4/30 bg-gradient-to-br from-chart-4/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <i className="fas fa-headphones text-chart-4 mr-2"></i>
                  How Sofia "Hears" Music
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-chart-4/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-chart-4 font-bold">1</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You search for and select a song to share
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-chart-4/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-chart-4 font-bold">2</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We analyze the track's audio features (tempo, energy, mood, etc.)
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-chart-4/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-chart-4 font-bold">3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Those features get translated into a natural description Sofia can understand
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-chart-4/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-chart-4 font-bold">4</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sofia receives the description and can respond to the music you shared!
                  </p>
                </div>
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
                        <div className="w-10 h-10 bg-chart-4/20 rounded flex items-center justify-center">
                          <i className="fas fa-music text-chart-4 text-sm"></i>
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
                          onClick={() => prepareShareMutation.mutate(item.track.id)}
                          data-testid={`button-share-recent-${index}`}
                        >
                          <i className="fas fa-heart text-xs"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-history text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground">No recent tracks</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (Requires Spotify OAuth - coming soon)
                    </p>
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
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.location.href = '/file-sharing'}
                  data-testid="button-share-suno"
                >
                  <i className="fas fa-headphones mr-2"></i>
                  Share Suno Creation (WAV)
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.open('https://open.spotify.com/search/Kindroid%20List', '_blank')}
                  data-testid="button-open-kindroid-playlist"
                >
                  <i className="fab fa-spotify mr-2"></i>
                  Open Kindroid Playlist
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
                data-testid="button-open-kindroid-playlist-2"
              >
                <i className="fab fa-spotify mr-2"></i>
                Open in Spotify
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {kindroidListLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-4">Loading Sofia's music choices...</p>
              </div>
            ) : kindroidListData?.tracks && kindroidListData.tracks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {kindroidListData.tracks.map((track: KindroidListTrack) => {
                  const addedDate = new Date(track.addedAt);
                  const now = new Date();
                  const diffMs = now.getTime() - addedDate.getTime();
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                  let timeAgo = '';
                  if (diffDays > 0) {
                    timeAgo = `${diffDays}d ago`;
                  } else if (diffHours > 0) {
                    timeAgo = `${diffHours}h ago`;
                  } else {
                    timeAgo = 'Just now';
                  }

                  return (
                    <div key={track.id} className="flex items-center p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                      {track.imageUrl ? (
                        <img src={track.imageUrl} alt={track.name} className="w-12 h-12 rounded object-cover mr-3" />
                      ) : (
                        <div className="w-12 h-12 bg-chart-4/20 rounded flex items-center justify-center mr-3">
                          <i className="fas fa-music text-chart-4"></i>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{track.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                        <p className="text-xs text-chart-4">{timeAgo} by Sofia</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
                <i className="fas fa-music text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground mb-2">No songs added yet</p>
                <p className="text-sm text-muted-foreground">
                  Sofia can add songs by saying "SONG: [name], ARTIST: [artist]" during your calls
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Share Preview Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <i className="fas fa-heart text-primary mr-2"></i>
              Share with Sofia
            </DialogTitle>
          </DialogHeader>

          {sharePreview && (
            <div className="space-y-4">
              {/* Track Info */}
              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                {sharePreview.track.imageUrl ? (
                  <img
                    src={sharePreview.track.imageUrl}
                    alt={sharePreview.track.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-chart-4/20 rounded flex items-center justify-center">
                    <i className="fas fa-music text-chart-4 text-2xl"></i>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">{sharePreview.track.name}</p>
                  <p className="text-muted-foreground truncate">{sharePreview.track.artist}</p>
                  <p className="text-sm text-muted-foreground truncate">{sharePreview.track.album}</p>
                </div>
              </div>

              {/* Audio Analysis */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center">
                    {getMoodEmoji(sharePreview.description.mood)} Audio Analysis
                  </h4>
                  <div className="text-right">
                    <span className="text-sm text-chart-4 font-medium">
                      {Math.round(sharePreview.features.tempo)} BPM
                    </span>
                    {sharePreview.features.key >= 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {KEY_NAMES[sharePreview.features.key]} {sharePreview.features.mode === 1 ? 'Major' : 'Minor'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Feature Bars */}
                <div className="space-y-2 mb-4">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Energy</span>
                      <span>{Math.round(sharePreview.features.energy * 100)}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="bg-chart-1 h-2 rounded-full transition-all"
                        style={{ width: `${sharePreview.features.energy * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Mood (Valence)</span>
                      <span>{Math.round(sharePreview.features.valence * 100)}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="bg-chart-2 h-2 rounded-full transition-all"
                        style={{ width: `${sharePreview.features.valence * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Danceability</span>
                      <span>{Math.round(sharePreview.features.danceability * 100)}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="bg-chart-4 h-2 rounded-full transition-all"
                        style={{ width: `${sharePreview.features.danceability * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Acousticness</span>
                      <span>{Math.round(sharePreview.features.acousticness * 100)}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div
                        className="bg-chart-3 h-2 rounded-full transition-all"
                        style={{ width: `${sharePreview.features.acousticness * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Description Preview */}
                <div className="bg-background rounded p-3">
                  <p className="text-xs text-muted-foreground mb-1">What Sofia will receive:</p>
                  <p className="text-sm italic">"{sharePreview.description.details}"</p>
                </div>
              </div>

              {/* Share Button */}
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsShareDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/80"
                  onClick={() => shareMusicMutation.mutate(sharePreview)}
                  disabled={shareMusicMutation.isPending}
                >
                  {shareMusicMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sharing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-heart mr-2"></i>
                      Share with Sofia
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
