import { motion } from "framer-motion";
import { Brain, GitBranch, BarChart3, Zap, ShieldCheck, Code2 } from "lucide-react";

const features = [
  { icon: Brain, title: "Intent Detection", desc: "Understands what you were trying to build from comments, structure, and naming." },
  { icon: GitBranch, title: "Progress Mapping", desc: "Identifies completed vs incomplete sections across your codebase." },
  { icon: BarChart3, title: "Momentum Score", desc: "Quantifies how far you got and where to pick back up." },
  { icon: Zap, title: "Instant Resume", desc: "One click to get a structured summary of goals and next steps." },
  { icon: ShieldCheck, title: "Risk Alerts", desc: "Spots bugs, missing edge cases, and incomplete error handling." },
  { icon: Code2, title: "Multi-Language", desc: "Supports Python, TypeScript, Rust, Go, and more." },
];

const Features = () => (
  <section id="features" className="py-24 relative">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">Features</h2>
        <p className="text-muted-foreground max-w-md mx-auto">Everything you need to recover context and get back to building.</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="group rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center mb-4">
              <f.icon className="w-4 h-4 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
