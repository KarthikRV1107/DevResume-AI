import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, Code, Brain, Trash2, ChevronRight, AlertTriangle, Download, FileText, Shield, ShieldCheck, Package, Scale, RotateCcw, Lightbulb, Bug } from "lucide-react";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import Background3D from "@/components/Background3D";
import Navbar from "@/components/Navbar";

interface SecurityFinding {
  category?: string;
  severity: string;
  title: string;
  description?: string;
  owasp?: string;
  cwe?: string;
  remediation?: string;
}
interface DependencyFinding {
  package: string;
  version?: string;
  severity: string;
  issue: string;
  recommendation?: string;
}
interface ComplianceCheck {
  framework: string;
  control: string;
  status: "pass" | "fail" | "warning" | "not_applicable" | string;
  description?: string;
  remediation?: string;
}
interface IssueItem { type: string; message: string; severity: string; line?: number }

interface Analysis {
  id: string;
  code: string;
  language: string | null;
  goal: string | null;
  project_name: string | null;
  current_state: string | null;
  completion_percentage: number | null;
  effort_level: string | null;
  next_steps: string[];
  risks: string[];
  issues: IssueItem[];
  architectural_improvements: string[];
  security_issues: SecurityFinding[];
  dependency_audit: DependencyFinding[];
  compliance_checks: ComplianceCheck[];
  confidence_score: number | null;
  total_files: number | null;
  created_at: string;
}

type TabKey = "overview" | "security" | "dependencies" | "compliance";

const severityColor = (sev?: string) => {
  switch ((sev || "").toLowerCase()) {
    case "critical": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    case "medium": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    case "low": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    default: return "text-muted-foreground bg-secondary border-border";
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "pass": return "text-green-400 bg-green-500/10 border-green-500/20";
    case "fail": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "warning": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    default: return "text-muted-foreground bg-secondary border-border";
  }
};

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchAnalyses = async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load history");
      } else {
        setAnalyses((data || []).map((d: any) => ({
          ...d,
          next_steps: Array.isArray(d.next_steps) ? d.next_steps : [],
          risks: Array.isArray(d.risks) ? d.risks : [],
          issues: Array.isArray(d.issues) ? d.issues : [],
          architectural_improvements: Array.isArray(d.architectural_improvements) ? d.architectural_improvements : [],
          security_issues: Array.isArray(d.security_issues) ? d.security_issues : [],
          dependency_audit: Array.isArray(d.dependency_audit) ? d.dependency_audit : [],
          compliance_checks: Array.isArray(d.compliance_checks) ? d.compliance_checks : [],
        })));
      }
      setLoading(false);
    };
    fetchAnalyses();
  }, [user]);

  const deleteAnalysis = async (id: string) => {
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Analysis deleted");
    }
  };

  const reanalyze = (a: Analysis) => {
    navigate("/analysis", { state: { reanalyzeCode: a.code, projectName: a.project_name || "" } });
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen relative">
      <Background3D />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Analysis <span className="text-gradient">History</span>
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-mono">Loading...</div>
        ) : analyses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-4"
          >
            <Brain className="w-12 h-12 text-primary/30 mx-auto" />
            <p className="text-muted-foreground font-mono">No analyses yet. Try the demo!</p>
            <Button variant="hero" onClick={() => navigate("/#demo")}>Analyze Code</Button>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              {analyses.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(a)}
                  onDoubleClick={() => setTab("overview")}
                  className={`cursor-pointer rounded-lg border p-4 transition-all duration-200 ${
                    selected?.id === a.id
                      ? "border-primary bg-primary/5 glow-border"
                      : "border-border bg-card/60 backdrop-blur-sm hover:border-primary/40 glow-border-hover"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {a.goal || "Untitled analysis"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.language && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                            {a.language}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {a.completion_percentage != null && (
                        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${a.completion_percentage}%`,
                              background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(185 70% 50%))",
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Detail */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6 space-y-5 font-mono text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {selected.language && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                          {selected.language}
                        </span>
                      )}
                      {selected.project_name && (
                        <span className="text-xs text-muted-foreground truncate max-w-[50%]">{selected.project_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {selected.confidence_score != null && `Confidence: ${Math.round(Number(selected.confidence_score) * 100)}%`}
                      </span>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-border -mx-2 px-2 overflow-x-auto">
                      {([
                        { k: "overview", label: "Overview", Icon: Brain },
                        { k: "security", label: `Security${selected.security_issues.length ? ` (${selected.security_issues.length})` : ""}`, Icon: Shield },
                        { k: "dependencies", label: `Dependencies${selected.dependency_audit.length ? ` (${selected.dependency_audit.length})` : ""}`, Icon: Package },
                        { k: "compliance", label: `Compliance${selected.compliance_checks.length ? ` (${selected.compliance_checks.length})` : ""}`, Icon: Scale },
                      ] as { k: TabKey; label: string; Icon: any }[]).map(({ k, label, Icon }) => (
                        <button
                          key={k}
                          onClick={() => setTab(k)}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
                            tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-3 h-3" /> {label}
                        </button>
                      ))}
                    </div>

                    {tab === "overview" && (
                      <div className="space-y-5">
                        <div>
                          <p className="text-primary text-xs mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> GOAL</p>
                          <p className="text-foreground">{selected.goal || "No goal detected"}</p>
                        </div>

                        {selected.current_state && (
                          <div>
                            <p className="text-primary text-xs mb-1">CURRENT STATE</p>
                            <p className="text-foreground/80">{selected.current_state}</p>
                          </div>
                        )}

                        {selected.next_steps.length > 0 && (
                          <div>
                            <p className="text-primary text-xs mb-1 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> NEXT STEPS</p>
                            <ul className="space-y-1">
                              {selected.next_steps.map((n, i) => (
                                <li key={i} className="text-foreground flex items-start gap-2">
                                  <span className="text-primary mt-0.5">▸</span> {String(n)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selected.risks.length > 0 && (
                          <div>
                            <p className="text-primary text-xs mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> RISKS</p>
                            <ul className="space-y-1">
                              {selected.risks.map((r, i) => (
                                <li key={i} className="text-yellow-400/80 flex items-start gap-2">
                                  <span className="mt-0.5">⚠</span> {String(r)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selected.issues.length > 0 && (
                          <div>
                            <p className="text-primary text-xs mb-1 flex items-center gap-1"><Bug className="w-3 h-3" /> ISSUES</p>
                            <ul className="space-y-1.5">
                              {selected.issues.map((it, i) => (
                                <li key={i} className="rounded border border-border bg-background/50 p-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${severityColor(it.severity)}`}>{it.severity || "info"}</span>
                                    <span className="text-[11px] text-muted-foreground">{it.type}{it.line != null ? ` · L${it.line}` : ""}</span>
                                  </div>
                                  <p className="text-xs text-foreground mt-1">{it.message}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selected.architectural_improvements.length > 0 && (
                          <div>
                            <p className="text-primary text-xs mb-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> ARCHITECTURAL IMPROVEMENTS</p>
                            <ul className="space-y-1">
                              {selected.architectural_improvements.map((a, i) => (
                                <li key={i} className="text-foreground flex items-start gap-2">
                                  <span className="text-primary mt-0.5">◆</span> {String(a)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selected.completion_percentage != null && (
                          <div>
                            <p className="text-primary text-xs mb-1">MOMENTUM</p>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${selected.completion_percentage}%` }}
                                transition={{ duration: 1 }}
                                className="h-full rounded-full"
                                style={{ background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(185 70% 50%))" }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                              <span>{selected.completion_percentage}% complete</span>
                              {selected.effort_level && <span>Effort: {selected.effort_level}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {tab === "security" && (
                      <div className="space-y-2">
                        {selected.security_issues.length > 0 ? (
                          selected.security_issues.map((f, i) => (
                            <div key={i} className="rounded-lg border border-border bg-background/50 p-3 space-y-1.5">
                              <div className="flex items-start gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${severityColor(f.severity)}`}>{f.severity}</span>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-foreground">{f.title}</p>
                                  {f.description && <p className="text-[11px] text-muted-foreground">{f.description}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {f.category && <span className="text-[10px] text-muted-foreground/70">{f.category}</span>}
                                {f.owasp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{f.owasp}</span>}
                                {f.cwe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{f.cwe}</span>}
                              </div>
                              {f.remediation && <p className="text-[11px] text-primary/80">💡 {f.remediation}</p>}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No security findings recorded.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {tab === "dependencies" && (
                      <div className="space-y-2">
                        {selected.dependency_audit.length > 0 ? (
                          selected.dependency_audit.map((dep, i) => (
                            <div key={i} className="rounded-lg border border-border bg-background/50 p-3 space-y-1">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-foreground">{dep.package}</span>
                                {dep.version && <span className="text-[10px] text-muted-foreground">v{dep.version}</span>}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ml-auto ${severityColor(dep.severity)}`}>{dep.severity}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{dep.issue}</p>
                              {dep.recommendation && <p className="text-[11px] text-primary/80">💡 {dep.recommendation}</p>}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No dependency findings.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {tab === "compliance" && (
                      <div className="space-y-3">
                        {selected.compliance_checks.length > 0 ? (
                          Array.from(new Set(selected.compliance_checks.map(c => c.framework))).map(fw => {
                            const fwChecks = selected.compliance_checks.filter(c => c.framework === fw);
                            const passCount = fwChecks.filter(c => c.status === "pass").length;
                            return (
                              <div key={fw}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Scale className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-bold text-primary">{fw}</span>
                                  <span className="text-[10px] text-muted-foreground ml-auto">{passCount}/{fwChecks.length} passing</span>
                                </div>
                                <div className="space-y-1.5">
                                  {fwChecks.map((check, i) => (
                                    <div key={i} className="flex items-start gap-2 rounded border border-border bg-background/50 p-2">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${statusBadge(check.status)}`}>{check.status}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-foreground">{check.control}</p>
                                        {check.description && <p className="text-[10px] text-muted-foreground">{check.description}</p>}
                                        {check.remediation && <p className="text-[10px] text-primary/70 mt-0.5">💡 {check.remediation}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8">
                            <Scale className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No compliance data available.</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="text-primary text-xs mb-1 flex items-center gap-1"><Code className="w-3 h-3" /> CODE</p>
                      <pre className="bg-background/50 rounded p-3 text-xs text-muted-foreground overflow-x-auto max-h-48">
                        {selected.code}
                      </pre>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                      <Button
                        variant="hero"
                        size="sm"
                        onClick={() => reanalyze(selected)}
                        className="flex-1 text-xs min-w-[140px]"
                      >
                        <RotateCcw className="w-3 h-3" /> Re-analyze
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportAsMarkdown({
                          ...selected,
                          next_steps: selected.next_steps,
                          risks: selected.risks,
                        })}
                        className="flex-1 text-xs"
                      >
                        <FileText className="w-3 h-3" /> Export .md
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportAsPDF({
                          ...selected,
                          next_steps: selected.next_steps,
                          risks: selected.risks,
                        })}
                        className="flex-1 text-xs"
                      >
                        <Download className="w-3 h-3" /> Export PDF
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-12 text-center"
                  >
                    <Brain className="w-10 h-10 text-primary/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm font-mono">Select an analysis to view details</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
