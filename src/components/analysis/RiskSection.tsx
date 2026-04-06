import { motion } from "framer-motion";
import { TrendingDown, AlertTriangle, Shield, Zap, Wrench } from "lucide-react";

interface Issue {
  type: string;
  message: string;
  severity: string;
}

interface RiskSectionProps {
  issues: Issue[];
  risks: string[];
  completionPercentage: number;
}

const RiskSection = ({ issues, risks, completionPercentage }: RiskSectionProps) => {
  const securityRisk = Math.min(100, issues.filter((i) => i.type === "security").length * 20);
  const perfRisk = Math.min(100, issues.filter((i) => i.type === "performance").length * 15);
  const techDebt = Math.min(100, issues.length * 5);
  const maintainability = Math.max(0, 100 - techDebt);

  const riskScores = [
    { label: "Technical Debt", value: techDebt, icon: Wrench, color: techDebt > 60 ? "text-destructive" : techDebt > 30 ? "text-yellow-400" : "text-primary" },
    { label: "Security Risk", value: securityRisk, icon: Shield, color: securityRisk > 60 ? "text-destructive" : securityRisk > 30 ? "text-yellow-400" : "text-primary" },
    { label: "Performance Risk", value: perfRisk, icon: Zap, color: perfRisk > 60 ? "text-destructive" : perfRisk > 30 ? "text-yellow-400" : "text-primary" },
    { label: "Maintainability", value: maintainability, icon: TrendingDown, color: maintainability < 40 ? "text-destructive" : maintainability < 70 ? "text-yellow-400" : "text-primary" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <TrendingDown className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">Risk Analysis</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {riskScores.map((score, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <score.icon className={`w-4 h-4 ${score.color}`} />
              <p className="text-xs text-muted-foreground font-mono">{score.label}</p>
            </div>
            <p className={`text-3xl font-bold font-mono ${score.color}`}>{score.value}</p>
            <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score.value}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
                className="h-full rounded-full bg-current opacity-50"
                style={{ color: score.value > 60 ? "hsl(0 84% 60%)" : score.value > 30 ? "hsl(45 93% 47%)" : "hsl(var(--primary))" }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Priority Issue List */}
      {issues.length > 0 && (
        <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4">
          <p className="text-xs text-primary font-mono mb-3">📋 PRIORITY ISSUES</p>
          <div className="space-y-2">
            {issues
              .sort((a, b) => {
                const order = { error: 0, warning: 1, info: 2 };
                return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
              })
              .slice(0, 10)
              .map((issue, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-mono">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded ${
                    issue.severity === "error" ? "bg-destructive/20 text-destructive" :
                    issue.severity === "warning" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>
                    {issue.severity === "error" ? "CRITICAL" : issue.severity === "warning" ? "HIGH" : "MEDIUM"}
                  </span>
                  <span className="text-muted-foreground truncate">{issue.message}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {risks.length > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm p-4">
          <p className="text-xs text-yellow-400 font-mono mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> IDENTIFIED RISKS
          </p>
          <ul className="space-y-1.5">
            {risks.map((r, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">⚠</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RiskSection;
