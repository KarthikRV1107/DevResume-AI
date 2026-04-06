import { motion } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface Issue {
  type: string;
  message: string;
  severity: string;
  line?: number;
}

interface SecuritySectionProps {
  issues: Issue[];
  risks: string[];
}

const OWASP_CATEGORIES = [
  { id: "A01", name: "Broken Access Control", icon: "🔓" },
  { id: "A02", name: "Cryptographic Failures", icon: "🔐" },
  { id: "A03", name: "Injection", icon: "💉" },
  { id: "A04", name: "Insecure Design", icon: "📐" },
  { id: "A05", name: "Security Misconfiguration", icon: "⚙️" },
  { id: "A06", name: "Vulnerable Components", icon: "📦" },
  { id: "A07", name: "Auth Failures", icon: "🔑" },
  { id: "A08", name: "Data Integrity", icon: "🔄" },
  { id: "A09", name: "Logging Failures", icon: "📝" },
  { id: "A10", name: "SSRF", icon: "🌐" },
];

const SecuritySection = ({ issues, risks }: SecuritySectionProps) => {
  const securityIssues = issues.filter((i) => i.type === "security");
  const criticalCount = securityIssues.filter((i) => i.severity === "error").length;
  const warningCount = securityIssues.filter((i) => i.severity === "warning").length;
  const securityScore = Math.max(0, 100 - criticalCount * 20 - warningCount * 10);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">Security Analysis</h2>
        <span className={`text-xs px-2.5 py-1 rounded font-bold border font-mono ${
          securityScore >= 80 ? "bg-primary/20 text-primary border-primary/30" :
          securityScore >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
          "bg-destructive/20 text-destructive border-destructive/30"
        }`}>
          Score: {securityScore}/100
        </span>
      </div>

      {/* Security Score Gauge */}
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-primary font-mono">SECURITY SCORE</p>
          <p className={`text-2xl font-bold font-mono ${
            securityScore >= 80 ? "text-primary" : securityScore >= 50 ? "text-yellow-400" : "text-destructive"
          }`}>{securityScore}%</p>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${securityScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: securityScore >= 80
                ? `linear-gradient(90deg, hsl(var(--primary)), hsl(142 71% 55%))`
                : securityScore >= 50
                ? `linear-gradient(90deg, hsl(45 93% 47%), hsl(38 92% 50%))`
                : `linear-gradient(90deg, hsl(0 84% 60%), hsl(0 72% 51%))`
            }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> {criticalCount} Critical</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-400" /> {warningCount} Warnings</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> {10 - criticalCount - warningCount} Passed</span>
        </div>
      </div>

      {/* Vulnerability Scan */}
      {securityIssues.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 backdrop-blur-sm p-4">
          <p className="text-xs text-destructive font-mono mb-3 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> VULNERABILITIES DETECTED
          </p>
          <div className="space-y-2">
            {securityIssues.map((issue, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-md bg-card/50 border border-border"
              >
                <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                  issue.severity === "error" ? "bg-destructive" : "bg-yellow-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{issue.message}</p>
                  {issue.line && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Line {issue.line}</p>}
                </div>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  issue.severity === "error" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"
                }`}>
                  {issue.severity}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* OWASP Top 10 */}
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4">
        <p className="text-xs text-primary font-mono mb-3">🛡️ OWASP TOP 10 COMPLIANCE</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {OWASP_CATEGORIES.map((cat) => {
            const hasIssue = securityIssues.some((i) => i.message.toLowerCase().includes(cat.name.toLowerCase().split(" ")[0]));
            return (
              <div
                key={cat.id}
                className={`flex items-center gap-2 p-2.5 rounded-md border text-xs font-mono ${
                  hasIssue
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border bg-card/30 text-muted-foreground"
                }`}
              >
                <span>{cat.icon}</span>
                <span className="flex-1">{cat.id}: {cat.name}</span>
                {hasIssue ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm p-4">
          <p className="text-xs text-yellow-400 font-mono mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> SECURITY RISKS
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

export default SecuritySection;
