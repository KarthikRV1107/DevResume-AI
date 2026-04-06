import { motion } from "framer-motion";
import { Code2, AlertCircle, Info, AlertTriangle } from "lucide-react";

interface Issue {
  type: string;
  message: string;
  severity: string;
  line?: number;
}

interface CodeQualitySectionProps {
  issues: Issue[];
  codeQualityGrade?: string;
  architecturalImprovements: string[];
  metrics?: {
    total_lines: number;
    code_lines: number;
    comment_lines: number;
    comment_ratio: number;
    functions: number;
    classes: number;
    imports: number;
  };
}

const ISSUE_CATEGORIES = [
  { type: "complexity", label: "Complexity", icon: "🔄", color: "text-yellow-400" },
  { type: "naming", label: "Naming", icon: "🏷️", color: "text-blue-400" },
  { type: "todo", label: "TODOs", icon: "📌", color: "text-muted-foreground" },
  { type: "stub", label: "Stubs", icon: "🔧", color: "text-yellow-400" },
  { type: "dead_code", label: "Dead Code", icon: "💀", color: "text-muted-foreground" },
  { type: "documentation", label: "Documentation", icon: "📝", color: "text-blue-400" },
  { type: "error_handling", label: "Error Handling", icon: "⚠️", color: "text-yellow-400" },
  { type: "performance", label: "Performance", icon: "⚡", color: "text-primary" },
  { type: "empty_function", label: "Empty Functions", icon: "📭", color: "text-muted-foreground" },
  { type: "missing_return", label: "Missing Returns", icon: "↩️", color: "text-destructive" },
];

const CodeQualitySection = ({ issues, codeQualityGrade, architecturalImprovements, metrics }: CodeQualitySectionProps) => {
  const nonSecurityIssues = issues.filter((i) => i.type !== "security");
  const categorizedIssues = ISSUE_CATEGORIES.map((cat) => ({
    ...cat,
    issues: nonSecurityIssues.filter((i) => i.type === cat.type),
  })).filter((cat) => cat.issues.length > 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Code2 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">Code Quality</h2>
        {codeQualityGrade && (
          <span className={`text-lg px-3 py-1 rounded font-bold border font-mono ${
            codeQualityGrade === "A" ? "bg-primary/20 text-primary border-primary/30" :
            codeQualityGrade === "B" ? "bg-primary/10 text-primary border-primary/20" :
            codeQualityGrade === "C" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
            "bg-destructive/20 text-destructive border-destructive/30"
          }`}>
            {codeQualityGrade}
          </span>
        )}
      </div>

      {/* Issue Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Errors", count: nonSecurityIssues.filter((i) => i.severity === "error").length, color: "text-destructive", icon: AlertCircle },
          { label: "Warnings", count: nonSecurityIssues.filter((i) => i.severity === "warning").length, color: "text-yellow-400", icon: AlertTriangle },
          { label: "Info", count: nonSecurityIssues.filter((i) => i.severity === "info").length, color: "text-blue-400", icon: Info },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 text-center"
          >
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Issues by Category */}
      {categorizedIssues.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-primary font-mono">🔍 ISSUES BY CATEGORY</p>
          {categorizedIssues.map((cat, ci) => (
            <motion.div
              key={cat.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.05 }}
              className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span>{cat.icon}</span>
                <span className="text-sm font-mono text-foreground font-medium">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">{cat.issues.length} issue(s)</span>
              </div>
              <div className="space-y-1.5">
                {cat.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                      issue.severity === "error" ? "bg-destructive" :
                      issue.severity === "warning" ? "bg-yellow-400" : "bg-blue-400"
                    }`} />
                    <span className="text-muted-foreground flex-1">{issue.message}</span>
                    {issue.line && <span className="text-muted-foreground/50 font-mono shrink-0">L{issue.line}</span>}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Architectural Improvements */}
      {architecturalImprovements.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm p-4">
          <p className="text-xs text-primary font-mono mb-2 flex items-center gap-1">💡 REFACTORING SUGGESTIONS</p>
          <ul className="space-y-1.5">
            {architecturalImprovements.map((a, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">◆</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CodeQualitySection;
