import { motion } from "framer-motion";
import { Brain, BarChart3, Target, AlertTriangle } from "lucide-react";

const features = [
  { icon: Brain, title: "Context Recovery", desc: "Reads your code and reconstructs what you were trying to build, even months later." },
  { icon: BarChart3, title: "Momentum Score", desc: "Quantifies how far along you were — so you know exactly where you left off." },
  { icon: Target, title: "Next Steps", desc: "Generates actionable next tasks based on TODO comments, incomplete functions, and patterns." },
  { icon: AlertTriangle, title: "Risk Radar", desc: "Identifies stale dependencies, security gaps, and technical debt in abandoned code." },
];

const Features = () => (
  <section id="features" className="py-24">
    <div className="container mx-auto px-4">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold text-center mb-16"
      >
        <span className="text-gradient">Features</span>
      </motion.h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card p-6 glow-border-hover transition-all duration-300 hover:border-primary/40"
          >
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
