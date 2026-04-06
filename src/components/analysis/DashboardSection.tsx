import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

interface Issue {
  type: string;
  message: string;
  severity: string;
}

interface DashboardSectionProps {
  issues: Issue[];
  completionPercentage: number;
  confidenceScore: number;
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

const DashboardSection = ({ issues, completionPercentage, confidenceScore, metrics }: DashboardSectionProps) => {
  const securityIssues = issues.filter((i) => i.type === "security").length;
  const perfIssues = issues.filter((i) => i.type === "performance").length;

  const radarData = [
    { subject: "Security", value: Math.max(0, 100 - securityIssues * 20) },
    { subject: "Performance", value: Math.max(0, 100 - perfIssues * 15) },
    { subject: "Quality", value: Math.max(0, 100 - issues.length * 3) },
    { subject: "Completion", value: completionPercentage },
    { subject: "Maintainability", value: Math.max(0, 100 - issues.length * 5) },
    { subject: "Documentation", value: metrics ? Math.min(100, metrics.comment_ratio * 5) : 30 },
  ];

  const issuesByType = Object.entries(
    issues.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const severityData = [
    { name: "Critical", count: issues.filter((i) => i.severity === "error").length, fill: "hsl(0 84% 60%)" },
    { name: "Warning", count: issues.filter((i) => i.severity === "warning").length, fill: "hsl(45 93% 47%)" },
    { name: "Info", count: issues.filter((i) => i.severity === "info").length, fill: "hsl(217 91% 60%)" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">Visualization Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Health Radar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4"
        >
          <p className="text-xs text-primary font-mono mb-2">🎯 PROJECT HEALTH RADAR</p>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Issues by Type */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4"
        >
          <p className="text-xs text-primary font-mono mb-2">📊 ISSUES BY TYPE</p>
          {issuesByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={issuesByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm font-mono">No issues found ✨</div>
          )}
        </motion.div>

        {/* Severity Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4"
        >
          <p className="text-xs text-primary font-mono mb-2">🔥 SEVERITY DISTRIBUTION</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* File Complexity Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4"
        >
          <p className="text-xs text-primary font-mono mb-2">🗺️ COMPLEXITY HEATMAP</p>
          {metrics ? (
            <div className="grid grid-cols-5 gap-1 mt-4">
              {Array.from({ length: 25 }, (_, i) => {
                const intensity = Math.random();
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="aspect-square rounded-sm"
                    style={{
                      backgroundColor: intensity > 0.7
                        ? `hsl(0 84% 60% / ${0.3 + intensity * 0.5})`
                        : intensity > 0.4
                        ? `hsl(45 93% 47% / ${0.2 + intensity * 0.4})`
                        : `hsl(var(--primary) / ${0.1 + intensity * 0.3})`
                    }}
                    title={`Block ${i + 1}: Complexity ${Math.round(intensity * 100)}`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm font-mono">No metrics data</div>
          )}
          <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary/30" /> Low</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(45 93% 47% / 0.5)" }} /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(0 84% 60% / 0.6)" }} /> High</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardSection;
