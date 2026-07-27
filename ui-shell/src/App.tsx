import { useState } from "react";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import StudioWorkspace from "./screens/StudioWorkspace";
import MangaWorkspace from "./screens/MangaWorkspace";
import { Image, Music, Film } from "lucide-react";

type Workspace = "visual-studio" | "audio-daw" | "manga-motion" | null;

export interface RecentProject {
  name: string;
  type: string;
  timestamp: string;
  icon: any;
  accentColor: string;
}

const INITIAL_PROJECTS: RecentProject[] = [
  { name: "Gintoki Tabby Cat Edit", type: "image", timestamp: "2 hours ago", icon: Image, accentColor: "#4f8fff" },
  { name: "Lofi Glass & Rain", type: "audio", timestamp: "Yesterday", icon: Music, accentColor: "#a855f7" },
  { name: "Chapter 1: The Awakening", type: "animation", timestamp: "3 days ago", icon: Film, accentColor: "#00e5c3" },
  { name: "Sunset Gradient Pack", type: "image", timestamp: "Last week", icon: Image, accentColor: "#4f8fff" },
  { name: "Ambient Forest Loop", type: "audio", timestamp: "Last week", icon: Music, accentColor: "#a855f7" },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(INITIAL_PROJECTS);

  const addRecentProject = (name: string, type: string, icon: any, accentColor: string) => {
    setRecentProjects(prev => [{ name, type, timestamp: "Just now", icon, accentColor }, ...prev]);
  };

  // ── Auth Handlers ────────────────────────────────────────────────────────
  const handleLogin = (name: string) => {
    setUsername(name);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setCurrentWorkspace(null);
  };

  // ── Navigation Handlers ──────────────────────────────────────────────────
  const handleSelectWorkspace = (workspace: string) => {
    setCurrentWorkspace(workspace as Workspace);
  };

  const handleBackToDashboard = () => {
    setCurrentWorkspace(null);
  };

  // ── Screen Router ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!currentWorkspace) {
    return (
      <DashboardScreen
        username={username}
        recentProjects={recentProjects}
        onSelectWorkspace={handleSelectWorkspace}
        onLogout={handleLogout}
      />
    );
  }

  if (currentWorkspace === "visual-studio") {
    return <StudioWorkspace defaultTab="photo" onBack={handleBackToDashboard} />;
  }

  if (currentWorkspace === "audio-daw") {
    return <StudioWorkspace defaultTab="audio" onBack={handleBackToDashboard} />;
  }

  // Manga Motion
  if (currentWorkspace === "manga-motion") {
    return <MangaWorkspace onBack={handleBackToDashboard} addRecentProject={addRecentProject} />;
  }

  return null;
}