import { motion } from "framer-motion";
import { AlertCircle, Lightbulb, Users, Rocket, TrendingUp, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const cards = [
  { icon: AlertCircle, title: "Problem", desc: "Developers abandon projects and lose hours re-learning their own code when they return." },
  { icon: Lightbulb, title: "Solution", desc: "AI-powered context recovery that reads your codebase and generates a resume of your progress." },
  { icon: Users, title: "Market", desc: "40M+ developers worldwide. Side projects, bootcamp grads, and returning contributors." },
  { icon: TrendingUp, title: "Traction", desc: "Live demo with real AI analysis. Multi-language support. Streaming results." },
  { icon: Globe, title: "Vision", desc: "Become the default 'Welcome Back' screen for every IDE and code editor." },
  { icon: Rocket, title: "Momentum", desc: "Built in 48 hours. Functional demo with real code analysis. Ready to scale." },
];

const Pitch = () => (
  <section id="pitch" className="py-24">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">Hackathon Pitch</span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Why DevResume AI matters — and where it's going.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-10">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -3 }}
            className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-6 glow-border-hover hover:border-primary/40 transition-all duration-300"
          >
            <c.icon className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-semibold text-foreground mb-1">{c.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
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
