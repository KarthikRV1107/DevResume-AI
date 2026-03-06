import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-14">
      {/* Subtle grid background */}
      <div className="absolute inset-0 subtle-grid" />
      
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
            Context Recovery Engine
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-foreground">
            You didn't lose your skill.{" "}
            <span className="text-muted-foreground">You lost your context.</span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-lg leading-relaxed">
            DevResume AI reads your unfinished code and recovers your goals, progress, and next steps — so you can resume building in minutes, not hours.
          </p>

          <div className="flex gap-3 flex-wrap">
            <Button size="lg">Get Started</Button>
            <Button variant="outline" size="lg">See Demo</Button>
          </div>
        </motion.div>

        {/* Right — code card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm font-mono text-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-destructive/40" />
              <span className="w-3 h-3 rounded-full bg-yellow-400/40" />
              <span className="w-3 h-3 rounded-full bg-green-400/40" />
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

          {/* AI analysis card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="absolute -bottom-6 -left-4 md:-left-8 w-72 rounded-xl border border-border bg-background p-4 shadow-lg"
          >
            <p className="text-xs font-medium text-foreground mb-2">AI Analysis</p>
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
                    transition={{ duration: 1, delay: 1 }}
                    className="h-full rounded-full bg-foreground"
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
