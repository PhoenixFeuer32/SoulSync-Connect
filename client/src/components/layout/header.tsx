import { vscodeThemes } from "@/vscodeThemes";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

type ThemeItem = {
  name: string;
  source: string;
  preview?: string;
  repo?: string | null;
  type?: string;
};

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/call-interface": "Call Interface",
  "/companions": "Companions",
  "/spotify-integration": "Spotify Integration",
  "/file-sharing": "File Sharing",
  "/sms-management": "SMS Management",
  "/api-credentials": "API Credentials",
  "/diagnostics": "Diagnostics",
  "/setup-guide": "Setup Guide",
  "/legal-tos": "Legal & ToS",
};

export default function Header() {
  const [location] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [search, setSearch] = useState("");
  const [themeList, setThemeList] = useState<ThemeItem[]>(vscodeThemes);

  const fetchThemes = async (query: string) => {
  try {
    const res = await fetch(`/api/themes/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setThemeList(data);
  } catch (err) {
    setThemeList([]); // Show no results if fetch fails
  }
};

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

    // <-- Add this function here!
  const applyTheme = (theme: string) => {
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--background', '#050000ff');
      document.documentElement.style.setProperty('--foreground', '#ffffffff');
    } else if (theme === 'light') {
      document.documentElement.style.setProperty('--background', '#ffffffff');
      document.documentElement.style.setProperty('--foreground', '#050000ff');
    }
    setShowThemeDropdown(false);
  };

  const applyVSCodeTheme = async (themeUrl: string) => {
    try {
      const res = await fetch(themeUrl);
      const themeJson = await res.json();
      if (themeJson.colors) {
        if (themeJson.colors["editor.background"]) {
          document.documentElement.style.setProperty("--background", themeJson.colors["editor.background"]);
        }
        if (themeJson.colors["editor.foreground"]) {
          document.documentElement.style.setProperty("--foreground", themeJson.colors["editor.foreground"]);
        }
        // Add more mappings as needed!
      }
      setShowThemeDropdown(false);
    } catch (err) {
      alert("Failed to load theme!");
    }
  };

  const pageTitle = pageTitles[location] || "Unknown Page";

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-foreground">{pageTitle}</h2>
          <div className="flex items-center space-x-2 px-3 py-1 bg-muted rounded-full">
            <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">All systems operational</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
           {/* Theme Button */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-muted-foreground hover:text-foreground"
              title="Change Theme"
              onClick={() => setShowThemeDropdown((v) => !v)}
              data-testid="button-theme"
            >
              <span role="img" aria-label="theme" className="text-lg">🎨</span>
            </Button>

            {/* Theme Dropdown */}
            {showThemeDropdown && (
              <div className="absolute right-16 top-12 bg-card border border-border rounded shadow-lg p-4 z-50 w-80">
                <div className="font-bold mb-2">VS Code & Open Source Themes</div>
                <div className="flex mb-2 space-x-2">
                  <input
                    type="text"
                    placeholder="Search themes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-foreground bg-card"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchThemes(search)}
                  >
                    Search
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {themeList.map(theme => (
                    <button
                      key={theme.name}
                      className="block w-full text-left py-1 px-2 hover:bg-muted rounded text-foreground bg-card"
                      style={{ background: theme.preview, color: "foreground" }}
                      onClick={() => {
                        if (
                          theme.type === "OpenVSX" ||
                          theme.type === "GitHub" ||
                          (theme.source && theme.source.endsWith(".json"))
                        ) {
                          applyVSCodeTheme(theme.source);
                        } else {
                          window.open(theme.source, "_blank");
                        }
                      }}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
                <button className="block w-full text-left py-1 px-2 hover:bg-muted rounded mt-2 text-foreground" onClick={() => setShowThemeDropdown(false)}>Close</button>
              </div>
            )}
             
          {/* Real-time Clock */}
          <div className="text-sm text-muted-foreground" data-testid="current-time">
            <i className="fas fa-clock mr-2"></i>
            <span>{currentTime}</span>
          </div>
          
          {/* Notification Bell */}
          <Button
            variant="ghost"
            size="sm"
            className="relative p-2 text-muted-foreground hover:text-foreground"
            data-testid="button-notifications"
          >
            <i className="fas fa-bell text-lg"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full text-xs"></span>
          </Button>
          
          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            className="p-2 text-muted-foreground hover:text-foreground"
            data-testid="button-settings"
          >
            <i className="fas fa-cog text-lg"></i>
          </Button>
        </div>
      </div>
    </header>
  );
}
