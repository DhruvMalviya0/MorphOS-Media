import { useState, FormEvent } from "react";
import { Eye, EyeOff, Layers } from "lucide-react";

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      // Extract display name from email (part before @)
      const displayName = email.split("@")[0] || "Creator";
      onLogin(displayName);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-morph-bg overflow-hidden font-sans">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-[120px] animate-morph-pulse-glow"
          style={{ background: "radial-gradient(circle, #4f8fff 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15 blur-[140px] animate-morph-pulse-glow"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)", animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5 blur-[160px]"
          style={{ background: "radial-gradient(circle, #00e5c3 0%, transparent 60%)" }}
        />
      </div>

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-4 animate-morph-slide-up">
        <div
          className="rounded-2xl border border-morph-border p-8 sm:p-10"
          style={{
            background: "linear-gradient(135deg, rgba(22,22,22,0.9) 0%, rgba(18,18,18,0.95) 100%)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 0 80px rgba(79,143,255,0.04), 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Logo / Brand */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center border border-morph-border"
              style={{
                background: "linear-gradient(135deg, rgba(79,143,255,0.15) 0%, rgba(168,85,247,0.15) 100%)",
                boxShadow: "0 0 30px rgba(79,143,255,0.1)",
              }}
            >
              <Layers className="w-7 h-7 text-morph-accent-blue" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-morph-text tracking-tight">
                MorphOS Media
              </h1>
              <p className="text-sm text-morph-text-muted mt-1">
                AI-Powered Creative Suite
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-morph-bg rounded-lg border border-morph-border p-1 mb-6">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                !isSignUp
                  ? "bg-morph-card text-morph-text shadow-sm"
                  : "text-morph-text-muted hover:text-morph-text"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                isSignUp
                  ? "bg-morph-card text-morph-text shadow-sm"
                  : "text-morph-text-muted hover:text-morph-text"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-morph-text-muted uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-morph-bg border border-morph-border rounded-lg px-4 py-3 text-sm text-morph-text placeholder:text-morph-text-dim focus:outline-none focus:border-morph-accent-blue/50 focus:ring-1 focus:ring-morph-accent-blue/20 transition-all duration-200"
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-morph-text-muted uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-morph-bg border border-morph-border rounded-lg px-4 py-3 pr-11 text-sm text-morph-text placeholder:text-morph-text-dim focus:outline-none focus:border-morph-accent-blue/50 focus:ring-1 focus:ring-morph-accent-blue/20 transition-all duration-200"
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-morph-text-dim hover:text-morph-text-muted transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="flex flex-col gap-1.5 animate-morph-fade-in">
                <label className="text-xs font-medium text-morph-text-muted uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm your password"
                  className="w-full bg-morph-bg border border-morph-border rounded-lg px-4 py-3 text-sm text-morph-text placeholder:text-morph-text-dim focus:outline-none focus:border-morph-accent-blue/50 focus:ring-1 focus:ring-morph-accent-blue/20 transition-all duration-200"
                  autoComplete="new-password"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-morph-accent-blue/20 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #4f8fff 0%, #7c5cfc 50%, #a855f7 100%)",
                backgroundSize: "200% 200%",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundPosition = "100% 100%";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundPosition = "0% 0%";
              }}
            >
              {isSignUp ? "Create Account" : "Sign In to Studio"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-morph-text-dim mt-6">
            {isSignUp
              ? "Already have an account? "
              : "Don't have an account? "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-morph-accent-blue hover:underline cursor-pointer"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>

        {/* Floating version tag */}
        <p className="text-center text-[11px] text-morph-text-dim mt-6 tracking-wide">
          MorphOS Media Studio · v2.1.0
        </p>
      </div>
    </div>
  );
}
