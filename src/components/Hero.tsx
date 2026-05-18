import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center dot-grid overflow-hidden pt-16">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-mono text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Context Recovery Engine
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            DevResume AI — Recover lost developer context from your code.{" "}
            <span className="text-gradient">You didn't lose your skill, you lost your context.</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-lg">
            <span className="text-foreground">DevResume</span> AI reads your unfinished code and recovers your goals, progress, and next steps — so you can resume building in minutes, not hours.
          </p>

          <div className="flex gap-4 flex-wrap">
            <Button variant="hero" size="lg" onClick={() => navigate('/auth')}>Get Started</Button>
            <Button variant="hero-outline" size="lg" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>See Demo</Button>
          </div>
        </motion.div>

        {/* Right — fake editor */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          {/* Code card */}
          <div className="rounded-lg border border-border bg-card p-4 glow-border font-mono text-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-destructive/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-primary/70" />
              <span className="ml-2 text-xs text-muted-foreground">auth.py</span>
            </div>
            <pre className="text-muted-foreground leading-relaxed overflow-x-auto">
<code>{`class AuthService:
    def __init__(self):
        self.provider = "oauth2"
        self.tokens = {}

    # TODO: finish token refresh logic
    # TODO: add rate limiting
    # TODO: handle edge case for
    #       expired sessions
    def refresh(self, user_id):
        pass  # stuck here...`}</code>
            </pre>
          </div>

          {/* Floating AI analysis card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="absolute -bottom-6 -left-6 md:-left-10 w-72 rounded-lg border border-primary/30 bg-card/95 backdrop-blur-sm p-4 glow-border"
          >
            <p className="text-xs font-mono text-primary mb-2">AI Analysis</p>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">GOAL:</span>{" "}
                <span className="text-foreground">OAuth2 token refresh flow</span>
              </div>
              <div>
                <span className="text-muted-foreground">NEXT:</span>{" "}
                <span className="text-foreground">Implement refresh() with expiry check</span>
              </div>
              <div>
                <span className="text-muted-foreground">MOMENTUM:</span>
                <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "35%" }}
                    transition={{ duration: 1.2, delay: 1.2 }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <span className="text-muted-foreground">35% complete</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
