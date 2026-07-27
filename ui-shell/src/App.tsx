import { useState } from "react";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import StudioWorkspace from "./screens/StudioWorkspace";

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

  // Manga Motion — placeholder for now
  if (currentWorkspace === "manga-motion") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-morph-bg font-sans">
        <div className="text-center animate-morph-fade-in">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center border border-morph-border"
            style={{
              background: "linear-gradient(135deg, rgba(0,229,195,0.15) 0%, rgba(0,229,195,0.05) 100%)",
              boxShadow: "0 0 40px rgba(0,229,195,0.1)",
            }}
          >
            <span className="text-4xl">📖</span>
          </div>
          <h1 className="text-2xl font-bold text-morph-text mb-2">Manga Motion</h1>
          <p className="text-morph-text-muted mb-8 max-w-sm mx-auto">
            Panel animation pipeline is under development. Stay tuned for AI-powered manga-to-motion conversion.
          </p>
          <button
            onClick={handleBackToDashboard}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-morph-text border border-morph-border hover:border-morph-border-light hover:bg-morph-card transition-all duration-200 cursor-pointer"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}