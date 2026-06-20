import { motion } from "framer-motion";
import { FileSearch, BarChart3, ListChecks, AlertTriangle, Code2, Lock } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "File Structure Reconstruction",
    desc: "Upload a ZIP or drag a project folder. It maps entry points, import graphs, and module boundaries without executing anything.",
    span: "lg:col-span-2",
  },
  {
    icon: BarChart3,
    title: "Completion Estimate",
    desc: "Rough percentage based on empty function bodies, TODO density, and stubbed imports. Know if you're at 30% or 85%.",
    span: "",
  },
  {
    icon: ListChecks,
    title: "Next Task Queue",
    desc: "Surfaces the most blocking items first: unfinished routes, unhandled errors, missing API integrations, unresolved merge markers.",
    span: "",
  },
  {
    icon: AlertTriangle,
    title: "Dependency Audit",
    desc: "Checks requirements.txt, package.json, Cargo.toml, and similar manifests for outdated versions, missing lockfiles, and known CVEs.",
    span: "lg:col-span-2",
  },
  {
    icon: Code2,
    title: "Language Coverage",
    desc: "Python, JavaScript, TypeScript, Go, Rust, Java, C/C++, PHP. More added by request.",
    span: "",
  },
  {
    icon: Lock,
    title: "Leak Detection",
    desc: "Scans for API keys, database URLs, and bearer tokens accidentally committed. Flags .env files and hardcoded credentials.",
    span: "lg:col-span-2",
  },
];

const Features = () => (
  <section id="features" className="py-24">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-14"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-3">
          <span className="text-gradient">What it actually does</span>
        </h2>
        <p className="text-muted-foreground max-w-xl">
          No vague promises. These are the specific checks and outputs you get when you feed it an abandoned codebase.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className={`group rounded-lg border border-border bg-card/50 p-6 hover:border-primary/30 transition-colors ${f.span}`}
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
