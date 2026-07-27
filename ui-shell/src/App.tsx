import { useState } from "react";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import StudioWorkspace from "./screens/StudioWorkspace";
import MangaWorkspace from "./screens/MangaWorkspace";

type Workspace = "visual-studio" | "audio-daw" | "manga-motion" | null;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>(null);

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
    return <MangaWorkspace onBack={handleBackToDashboard} />;
  }

  return null;
}