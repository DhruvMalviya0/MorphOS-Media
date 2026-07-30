import {
  Search,
  LogOut,
  User,
  Clock,
  ChevronRight,
  Sparkles,
  Headphones,
  Palette,
  BookOpen,
  RefreshCw,
  Terminal,
  Play,
  Square,
  Loader2,
  ChevronDown,
  X
} from "lucide-react";

import { RecentProject } from "../App";
import { useServerManager } from "../contexts/ServerManagerContext";
import React, { useState, useEffect, useRef } from "react";

interface DashboardScreenProps {
  username: string;
  recentProjects: RecentProject[];
  onSelectWorkspace: (workspace: string) => void;
  onLogout: () => void;
}

type WorkspaceKey = "visual-studio" | "audio-daw" | "manga-motion";

interface ModuleCard {
  id: WorkspaceKey;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Palette;
  accentColor: string;
  glowColor: string;
  gradientFrom: string;
  gradientTo: string;
}


const modules: ModuleCard[] = [
  {
    id: "visual-studio",
    title: "Visual Studio",
    subtitle: "Photo Editing & Inpainting",
    description: "AI-powered image generation, inpainting masks, and diffusion-based canvas editing.",
    icon: Palette,
    accentColor: "text-morph-accent-blue",
    glowColor: "rgba(79,143,255,0.15)",
    gradientFrom: "#4f8fff",
    gradientTo: "#3b7aed",
  },
  {
    id: "audio-daw",
    title: "Audio DAW",
    subtitle: "Soundscape Generation",
    description: "Prompt-to-audio synthesis, beat analysis, tempo modification, and sample vault mixing.",
    icon: Headphones,
    accentColor: "text-morph-accent-purple",
    glowColor: "rgba(168,85,247,0.15)",
    gradientFrom: "#a855f7",
    gradientTo: "#8b41e0",
  },
  {
    id: "manga-motion",
    title: "Manga Motion",
    subtitle: "Panel Animation Pipeline",
    description: "Convert static manga panels into animated sequences with AI motion interpolation.",
    icon: BookOpen,
    accentColor: "text-morph-accent-teal",
    glowColor: "rgba(0,229,195,0.15)",
    gradientFrom: "#00e5c3",
    gradientTo: "#00c9ab",
  },
];


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen({ username, recentProjects, onSelectWorkspace, onLogout }: DashboardScreenProps) {
  const { status, logs, startServer, stopServer, restartServer } = useServerManager();
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (isConsoleOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isConsoleOpen]);

  const getStatusColor = () => {
    switch (status) {
      case 'running': return 'text-morph-accent-teal';
      case 'stopped': return 'text-morph-text-muted';
      default: return 'text-morph-accent-blue';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-morph-bg font-sans relative">
      {/* ─── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 h-16 bg-morph-surface border-b border-morph-border shrink-0 z-40">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(79,143,255,0.2) 100%, rgba(168,85,247,0.2) 100%)",
            }}
          >
            <Sparkles className="w-4 h-4 text-morph-accent-blue" />
          </div>
          <span className="text-base font-bold text-morph-text tracking-tight">MorphOS Media</span>
          <span className="text-xs text-morph-text-dim font-medium px-2 py-0.5 bg-morph-bg border border-morph-border rounded-full">
            Studio
          </span>
        </div>

        {/* Center: Search */}
        <div className="hidden sm:flex items-center gap-2 bg-morph-bg border border-morph-border rounded-lg px-3 py-2 w-full max-w-sm mx-8">
          <Search className="w-4 h-4 text-morph-text-dim shrink-0" />
          <input
            type="text"
            placeholder="Search projects, assets, workspaces..."
            className="bg-transparent text-sm text-morph-text placeholder:text-morph-text-dim outline-none w-full"
          />
        </div>

        {/* Right: User + Controls */}
        <div className="flex items-center gap-3">
          
          {/* Server Manager Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-morph-border rounded-lg hover:bg-morph-card-hover transition-all duration-200"
            >
              {(status === 'starting' || status === 'stopping') ? (
                <Loader2 className={`w-3.5 h-3.5 animate-spin ${getStatusColor()}`} />
              ) : (
                <Terminal className={`w-3.5 h-3.5 ${getStatusColor()}`} />
              )}
              <span className={`hidden sm:inline ${getStatusColor()} capitalize`}>Server {status}</span>
              <ChevronDown className="w-3 h-3 text-morph-text-muted" />
            </button>

            {isServerMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-morph-card border border-morph-border rounded-lg shadow-xl py-1 z-50">
                <button
                  onClick={() => { startServer(); setIsServerMenuOpen(false); }}
                  disabled={status !== 'stopped'}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-morph-text hover:bg-morph-card-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 text-morph-accent-teal" /> Start
                </button>
                <button
                  onClick={() => { stopServer(); setIsServerMenuOpen(false); }}
                  disabled={status === 'stopped'}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-morph-text hover:bg-morph-card-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 text-red-400" /> Stop
                </button>
                <button
                  onClick={() => { restartServer(); setIsServerMenuOpen(false); }}
                  disabled={status === 'stopped'}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-morph-text hover:bg-morph-card-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-morph-accent-blue" /> Restart
                </button>
                <div className="border-t border-morph-border my-1"></div>
                <button
                  onClick={() => { setIsConsoleOpen(true); setIsServerMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-morph-text hover:bg-morph-card-hover flex items-center gap-2"
                >
                  <Terminal className="w-3.5 h-3.5" /> Show Console
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-full bg-morph-card border border-morph-border flex items-center justify-center">
              <User className="w-4 h-4 text-morph-text-muted" />
            </div>
            <span className="text-sm text-morph-text-muted hidden md:inline capitalize">{username}</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-morph-text-muted border border-morph-border rounded-lg hover:text-morph-text hover:border-morph-border-light transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Server Console Modal */}
      {isConsoleOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
          <div className="w-full max-w-4xl h-[70vh] bg-[#0c0c0c] border border-morph-border rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-morph-border">
              <div className="flex items-center gap-2 text-morph-text">
                <Terminal className="w-4 h-4 text-morph-accent-blue" />
                <span className="font-semibold text-sm">Server Console</span>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border border-morph-border ${getStatusColor()}`}>
                  {status}
                </span>
              </div>
              <button onClick={() => setIsConsoleOpen(false)} className="text-morph-text-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-gray-300 leading-relaxed break-all">
              {logs.length === 0 ? (
                <div className="text-morph-text-dim italic">No logs available.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-1">
                    {log.startsWith('[STDOUT]') && <span className="text-blue-400">INFO: </span>}
                    {log.startsWith('[STDERR]') && <span className="text-red-400">ERR: </span>}
                    {log.startsWith('[System]') && <span className="text-green-400">SYS: </span>}
                    {log.replace(/\[.*?\]\s*/, '')}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Scrollable Content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto morph-scrollbar">
        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* Welcome Header */}
          <div className="mb-10 animate-morph-fade-in">
            <h1 className="text-3xl sm:text-4xl font-bold text-morph-text tracking-tight">
              {getGreeting()},{" "}
              <span
                className="bg-clip-text text-transparent capitalize"
                style={{ backgroundImage: "linear-gradient(135deg, #4f8fff, #a855f7)" }}
              >
                {username}
              </span>
              .
            </h1>
            <p className="text-morph-text-muted mt-2 text-base">
              What are you working on today?
            </p>
          </div>

          {/* ─── Module Selection Grid ────────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-morph-text-dim mb-5">
              Workspaces
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((mod, index) => (
                <button
                  key={mod.id}
                  onClick={() => onSelectWorkspace(mod.id)}
                  className="group relative text-left rounded-xl border border-morph-border bg-morph-card p-6 transition-all duration-300 hover:border-morph-border-light hover:bg-morph-card-hover cursor-pointer animate-morph-slide-up"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "backwards",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 40px ${mod.glowColor}, 0 8px 32px rgba(0,0,0,0.4)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  }}
                >
                  {/* Accent gradient line at top */}
                  <div
                    className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${mod.gradientFrom}, transparent)` }}
                  />

                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center border border-morph-border transition-all duration-300"
                      style={{ background: mod.glowColor }}
                    >
                      <mod.icon className={`w-5 h-5 ${mod.accentColor}`} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-morph-text-dim group-hover:text-morph-text-muted group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>

                  <h3 className="text-base font-semibold text-morph-text mb-1">
                    {mod.title}
                  </h3>
                  <p className="text-xs font-medium text-morph-text-muted mb-2">
                    {mod.subtitle}
                  </p>
                  <p className="text-xs text-morph-text-dim leading-relaxed">
                    {mod.description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* ─── Recent Projects ───────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-morph-text-dim mb-5">
              Recent Projects
            </h2>
            <div className="rounded-xl border border-morph-border bg-morph-card overflow-hidden">
              {recentProjects.map((project, index) => (
                <div
                  key={project.name}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-morph-border last:border-b-0 hover:bg-morph-card-hover transition-colors duration-200 cursor-pointer group animate-morph-fade-in"
                  style={{ animationDelay: `${300 + index * 80}ms`, animationFillMode: "backwards" }}
                >
                  {/* Type Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-morph-border"
                    style={{ background: `${project.accentColor}15` }}
                  >
                    <project.icon className="w-4 h-4" style={{ color: project.accentColor }} />
                  </div>

                  {/* Project Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-morph-text truncate group-hover:text-white transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-morph-text-dim capitalize">{project.type}</p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-xs text-morph-text-dim shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{project.timestamp}</span>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-morph-text-dim opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
