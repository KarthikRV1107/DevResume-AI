import { useState } from "react";
import { motion } from "framer-motion";
import { Terminal, Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import Background3D from "@/components/Background3D";

type Mode = "login" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username },
          },
        });
        if (error) throw error;
        toast.success("Check your email to verify your account!");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent!");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <Background3D />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md mx-4 rounded-lg border border-border bg-card/80 backdrop-blur-md p-8 glow-border relative z-10"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-2 text-primary font-bold text-xl mb-2">
          <Terminal className="w-5 h-5" />
          <span><span className="text-foreground">DevResume</span> AI</span>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Sign in to access your analysis history." :
           mode === "signup" ? "Start recovering your lost context." :
           "We'll send you a reset link."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="dev_hacker"
                  className="pl-10 bg-background/50 border-border"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="pl-10 bg-background/50 border-border"
              />
            </div>
          </div>

          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pl-10 bg-background/50 border-border"
                />
              </div>
            </div>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}

          <Button variant="hero" type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
            {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>Don't have an account?{" "}
              <button onClick={() => setMode("signup")} className="text-primary hover:underline">Sign up</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} className="text-primary hover:underline">Sign in</button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
