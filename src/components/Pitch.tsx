import { motion } from "framer-motion";
import { AlertCircle, Lightbulb, Users, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const cards = [
  { icon: AlertCircle, title: "Problem", desc: "Developers abandon projects and lose hours re-learning their own code when they return." },
  { icon: Lightbulb, title: "Solution", desc: "AI-powered context recovery that reads your codebase and generates a resume of your progress." },
  { icon: Users, title: "Market", desc: "40M+ developers worldwide. Side projects, bootcamp grads, and returning contributors." },
  { icon: Rocket, title: "Momentum", desc: "Built in 48 hours. Functional demo with real code analysis. Ready to scale." },
];

const Pitch = () => (
  <section id="pitch" className="py-24">
    <div className="container mx-auto px-4">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold text-center mb-12"
      >
        <span className="text-gradient">Hackathon Pitch</span>
      </motion.h2>

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card p-6 glow-border-hover hover:border-primary/40 transition-all duration-300"
          >
            <c.icon className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-semibold text-foreground mb-1">{c.title}</h3>
            <p className="text-sm text-muted-foreground">{c.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <Button variant="hero" size="lg" asChild>
          <a href="#demo">Try the Demo</a>
        </Button>
      </div>
    </div>
  </section>
);

export default Pitch;
