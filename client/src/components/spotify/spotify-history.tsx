import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Music, Calendar, User } from 'lucide-react';

interface PlaylistEntry {
  id: string;
  song: string;
  artist: string;
  addedAt: string;
  callId: string;
}

export function SpotifyPlaylistHistory() {
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylistHistory();
    
    // Set up WebSocket listener for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Listen for music metadata events
        if (data.type === 'song_added') {
          setEntries(prev => [
            {
              id: `${data.song}-${data.artist}-${Date.now()}`,
              song: data.song,
              artist: data.artist,
              addedAt: new Date().toISOString(),
              callId: data.callId || 'unknown'
            },
            ...prev
          ]);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
    
    return () => {
      ws.close();
    };
  }, []);

  const fetchPlaylistHistory = async () => {
    try {
      setLoading(true);
      // Fetch conversation messages with music metadata
      const response = await fetch('/api/spotify/playlist-history');
      
      if (!response.ok) {
        throw new Error('Failed to fetch playlist history');
      }
      
      const data = await response.json();
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching playlist history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Spotify Playlist History
          </CardTitle>
          <CardDescription>Songs added via Sofia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="w-5 h-5" />
          Spotify Playlist History
        </CardTitle>
        <CardDescription>
          Songs detected and added: {entries.length}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Music className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No songs added yet</p>
            <p className="text-sm text-gray-400">
              Start a call with Sofia and mention songs for them to be automatically added
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{entry.song}</h3>
                    <Badge variant="secondary" className="text-xs">
                      <User className="w-3 h-3 mr-1" />
                      {entry.artist}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(entry.addedAt)}
                    </span>
                    <span className="text-gray-400">Call: {entry.callId}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={fetchPlaylistHistory}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Refresh
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
