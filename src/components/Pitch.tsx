import { motion } from "framer-motion";
import { Lightbulb, Target, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const cards = [
  { icon: Lightbulb, title: "The Problem", desc: "Developers lose hours re-reading old code to recover context after breaks." },
  { icon: Target, title: "Our Solution", desc: "AI-powered context recovery that reads your code and tells you exactly where you left off." },
  { icon: Users, title: "Target Users", desc: "Solo devs, open-source contributors, and teams juggling multiple projects." },
  { icon: TrendingUp, title: "Impact", desc: "Cut ramp-up time by 80% and reduce context-switching overhead significantly." },
];

const Pitch = () => (
  <section id="pitch" className="py-24 bg-secondary/30">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">Hackathon Pitch</h2>
        <p className="text-muted-foreground max-w-md mx-auto">Why DevResume AI matters.</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center mb-4">
              <c.icon className="w-4 h-4 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{c.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <Button size="lg" asChild>
          <a href="#demo">Try the Demo</a>
        </Button>
      </div>
    </div>
  </section>
);

export default Pitch;
