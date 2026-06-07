import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [systemLog, setSystemLog] = useState<string>("Scanning hardware matrix...");
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);

  useEffect(() => {
    // Call the Rust command to invoke our Python hardware checker
    invoke<string>("fetch_hardware_profile")
      .then((response) => {
        setSystemLog(response);
        if (response.includes("CRITICAL ERROR") || response.includes("ERROR")) {
          setIsAlertActive(true);
        }
      })
      .catch((err) => {
        setSystemLog(`Bridge Failure: ${err}`);
        setIsAlertActive(true);
      });
  }, []);

  return (
    <div className="app-container">
      {/* Top Media Workspace Header */}
      <header className="workspace-header">
        <h1>MorphOS Media Studio</h1>
        <div className="status-badge">System Mode: Windows Active</div>
      </header>

      {/* Main Studio Viewport split */}
      <main className="studio-layout">
        <section className="canvas-viewport">
          <div className="placeholder-text">Photo/Video Visual Canvas Layers</div>
        </section>

        <section className="timeline-viewport">
          <div className="placeholder-text">Multi-track Audio Frequency Timeline</div>
        </section>
      </main>

      {/* Diagnostics Dynamic Notification Bar */}
      <footer className={`diagnostics-bar ${isAlertActive ? "alert-mode" : "clear-mode"}`}>
        <h3>Hardware Engine Diagnostics Log Output:</h3>
        <pre className="log-terminal">{systemLog}</pre>
      </footer>
    </div>
  );
}

export default App;