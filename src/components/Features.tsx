import { motion } from "framer-motion";
import { FileSearch, BarChart3, ListChecks, AlertTriangle, Code2, Lock } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Context Recovery",
    desc: "Reads your code and reconstructs what you were trying to build, even months later.",
  },
  {
    icon: BarChart3,
    title: "Momentum Score",
    desc: "Quantifies how far along you were — so you know exactly where you left off.",
  },
  {
    icon: ListChecks,
    title: "Next Steps",
    desc: "Generates actionable next tasks based on TODO comments, incomplete functions, and patterns.",
  },
  {
    icon: AlertTriangle,
    title: "Risk Radar",
    desc: "Identifies stale dependencies, security gaps, and technical debt in abandoned code.",
  },
  {
    icon: Code2,
    title: "Multi-Language",
    desc: "Supports Python, JavaScript, TypeScript, Java, C++, Go, Rust and more.",
  },
  {
    icon: Lock,
    title: "Security Scan",
    desc: "Detects hardcoded secrets, eval() usage, and common vulnerability patterns.",
  },
];

const Features = () => (
  <section id="features" className="py-24">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-14 text-center"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          <span className="text-gradient">Features</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Everything you need to recover lost context and resume building.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="group rounded-xl border border-border bg-card/50 p-6 hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
