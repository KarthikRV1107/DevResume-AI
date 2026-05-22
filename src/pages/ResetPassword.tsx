import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import Background3D from "@/components/Background3D";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase emits PASSWORD_RECOVERY when the user lands from the email link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check if a session already exists (link already consumed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
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

        <h1 className="text-2xl font-bold text-foreground mb-1">Set new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready
            ? "Enter your new password below."
            : "Waiting for recovery link... Open this page from the reset email."}
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">New Password</Label>
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

          <Button variant="hero" type="submit" className="w-full" disabled={loading || !ready}>
            {loading && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
            Update Password
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
