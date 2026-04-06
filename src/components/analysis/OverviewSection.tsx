import { motion } from "framer-motion";
import { Brain, ChevronRight, Zap, AlertTriangle, Download, FileText, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";

interface AnalysisResult {
  goal: string;
  language: string;
  current_state: string;
  completion_percentage: number;
  effort_level: string;
  next_steps: string[];
  risks: string[];
  issues: { type: string; message: string; severity: string; line?: number }[];
  confidence_score: number;
  architectural_improvements: string[];
  source: string;
  code_quality_grade?: string;
  highlights?: string[];
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

interface OverviewSectionProps {
  result: AnalysisResult;
  code: string;
  onGetSuggestions: () => void;
  suggestionsLoading: boolean;
}

const OverviewSection = ({ result, code, onGetSuggestions, suggestionsLoading }: OverviewSectionProps) => {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-foreground font-mono">Project Overview</h2>
        <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-mono">{result.language}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent-foreground border border-border font-mono">
          {result.source === "llm-enhanced" ? "✨ AI Enhanced" : "Static Analysis"}
        </span>
        {result.code_quality_grade && (
          <span className={`text-xs px-2.5 py-1 rounded font-bold border font-mono ${
            result.code_quality_grade === "A" ? "bg-primary/20 text-primary border-primary/30" :
            result.code_quality_grade === "B" ? "bg-primary/10 text-primary border-primary/20" :
            result.code_quality_grade === "C" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
            "bg-destructive/20 text-destructive border-destructive/30"
          }`}>
            Grade: {result.code_quality_grade}
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Completion", value: `${result.completion_percentage}%`, color: "text-primary" },
          { label: "Confidence", value: `${Math.round(result.confidence_score * 100)}%`, color: "text-primary" },
          { label: "Effort Level", value: result.effort_level, color: result.effort_level === "High" ? "text-destructive" : result.effort_level === "Medium" ? "text-yellow-400" : "text-primary" },
          { label: "Issues Found", value: `${result.issues.length}`, color: result.issues.length > 5 ? "text-destructive" : "text-yellow-400" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 text-center"
          >
            <p className="text-xs text-muted-foreground font-mono mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Metrics */}
      {result.metrics && (
        <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4">
          <p className="text-xs text-primary font-mono mb-3">📊 CODE METRICS</p>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 text-center">
            {[
              { label: "Total Lines", value: result.metrics.total_lines },
              { label: "Code Lines", value: result.metrics.code_lines },
              { label: "Comments", value: result.metrics.comment_lines },
              { label: "Comment %", value: `${result.metrics.comment_ratio}%` },
              { label: "Functions", value: result.metrics.functions },
              { label: "Classes", value: result.metrics.classes },
              { label: "Imports", value: result.metrics.imports },
            ].map((m, i) => (
              <div key={i}>
                <p className="text-lg font-bold text-foreground font-mono">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal & State */}
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 space-y-2">
        <p className="text-xs text-primary font-mono flex items-center gap-1"><Brain className="w-3 h-3" /> GOAL</p>
        <p className="text-foreground text-sm">{result.goal}</p>
        {result.current_state && <p className="text-muted-foreground text-xs">{result.current_state}</p>}
      </div>

      {/* Momentum */}
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-primary font-mono">MOMENTUM SCORE</p>
          <p className="text-xs text-muted-foreground font-mono">{result.completion_percentage}%</p>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${result.completion_percentage}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, hsl(var(--primary)), hsl(185 70% 50%))` }}
          />
        </div>
      </div>

      {/* Strengths */}
      {result.highlights && result.highlights.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm p-4">
          <p className="text-xs text-primary font-mono mb-2">✅ STRENGTHS</p>
          <ul className="space-y-1.5">
            {result.highlights.map((h, i) => (
              <li key={i} className="text-muted-foreground text-sm flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span> {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4">
        <p className="text-xs text-primary font-mono mb-2 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> NEXT STEPS</p>
        <ul className="space-y-1.5">
          {result.next_steps.map((n, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="text-foreground text-sm flex items-start gap-2">
              <span className="text-primary mt-0.5">▸</span> {n}
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Export */}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={() => exportAsMarkdown({ ...result, code, created_at: new Date().toISOString() })} className="flex-1 text-xs font-mono">
          <FileText className="w-3 h-3" /> Export .md
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportAsPDF({ ...result, code, created_at: new Date().toISOString() })} className="flex-1 text-xs font-mono">
          <Download className="w-3 h-3" /> Export PDF
        </Button>
        <Button variant="hero" size="sm" disabled={suggestionsLoading} onClick={onGetSuggestions} className="flex-1 text-xs font-mono">
          {suggestionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI Fixes
        </Button>
      </div>
    </div>
  );
};

export default OverviewSection;
