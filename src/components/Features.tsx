import { motion } from "framer-motion";
import { Brain, BarChart3, Target, AlertTriangle, Code, Shield } from "lucide-react";

const features = [
  { icon: Brain, title: "Context Recovery", desc: "Reads your code and reconstructs what you were trying to build, even months later.", color: "from-primary to-primary/60" },
  { icon: BarChart3, title: "Momentum Score", desc: "Quantifies how far along you were — so you know exactly where you left off.", color: "from-primary to-accent/60" },
  { icon: Target, title: "Next Steps", desc: "Generates actionable next tasks based on TODO comments, incomplete functions, and patterns.", color: "from-accent to-primary/60" },
  { icon: AlertTriangle, title: "Risk Radar", desc: "Identifies stale dependencies, security gaps, and technical debt in abandoned code.", color: "from-yellow-500/80 to-primary/60" },
  { icon: Code, title: "Multi-Language", desc: "Supports Python, JavaScript, TypeScript, Java, C++, Go, Rust and more.", color: "from-primary to-accent/60" },
  { icon: Shield, title: "Security Scan", desc: "Detects hardcoded secrets, eval() usage, and common vulnerability patterns.", color: "from-destructive/60 to-primary/60" },
];

const Features = () => (
  <section id="features" className="py-24">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">Features</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Everything you need to recover lost context and resume building.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group rounded-lg border border-border bg-card/60 backdrop-blur-sm p-6 glow-border-hover transition-all duration-300 hover:border-primary/40"
          >
            <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${f.color} bg-opacity-10 flex items-center justify-center mb-4 group-hover:shadow-[0_0_15px_-3px_hsl(142_71%_45%/0.3)] transition-shadow`}>
              <f.icon className="w-5 h-5 text-primary-foreground" />
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
