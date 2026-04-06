import { motion } from "framer-motion";
import { Zap, TrendingUp } from "lucide-react";

interface Issue {
  type: string;
  message: string;
  severity: string;
  line?: number;
}

interface PerformanceSectionProps {
  issues: Issue[];
}

const PerformanceSection = ({ issues }: PerformanceSectionProps) => {
  const perfIssues = issues.filter((i) => i.type === "performance");
  const perfScore = Math.max(0, 100 - perfIssues.length * 15);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Zap className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">Performance Analysis</h2>
      </div>

      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-primary font-mono">PERFORMANCE SCORE</p>
          <p className={`text-2xl font-bold font-mono ${
            perfScore >= 80 ? "text-primary" : perfScore >= 50 ? "text-yellow-400" : "text-destructive"
          }`}>{perfScore}/100</p>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${perfScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: perfScore >= 80
                ? `linear-gradient(90deg, hsl(var(--primary)), hsl(142 71% 55%))`
                : perfScore >= 50
                ? `linear-gradient(90deg, hsl(45 93% 47%), hsl(38 92% 50%))`
                : `linear-gradient(90deg, hsl(0 84% 60%), hsl(0 72% 51%))`
            }}
          />
        </div>
      </div>

      {/* Optimization Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { title: "Memory Management", desc: "Detect leaks, optimize allocation", icon: "🧠", status: perfIssues.length === 0 ? "good" : "warning" },
          { title: "API Performance", desc: "Response times, caching opportunities", icon: "🌐", status: "good" },
          { title: "Bundle Size", desc: "Tree shaking, code splitting", icon: "📦", status: perfIssues.some((i) => i.message.toLowerCase().includes("import")) ? "warning" : "good" },
          { title: "Rendering", desc: "DOM updates, re-render optimization", icon: "🖥️", status: "good" },
        ].map((cat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-lg border p-4 backdrop-blur-sm ${
              cat.status === "warning" ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{cat.icon}</span>
              <span className="text-sm font-mono font-medium text-foreground">{cat.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">{cat.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Performance Issues */}
      {perfIssues.length > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm p-4">
          <p className="text-xs text-yellow-400 font-mono mb-3">⚡ BOTTLENECKS DETECTED</p>
          <div className="space-y-2">
            {perfIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-card/50 border border-border text-sm">
                <TrendingUp className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-foreground">{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4">
        <p className="text-xs text-primary font-mono mb-2">🚀 OPTIMIZATION TECHNIQUES</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="text-primary">▸</span> Implement lazy loading for heavy modules</li>
          <li className="flex items-start gap-2"><span className="text-primary">▸</span> Add caching layers for repeated computations</li>
          <li className="flex items-start gap-2"><span className="text-primary">▸</span> Use memoization for expensive functions</li>
          <li className="flex items-start gap-2"><span className="text-primary">▸</span> Optimize database queries with proper indexing</li>
        </ul>
      </div>
    </div>
  );
};

export default PerformanceSection;
