import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ArrowLeft, Clock, Code, Brain, Trash2, ChevronRight, AlertTriangle, Zap, Download, FileText } from "lucide-react";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import Background3D from "@/components/Background3D";
import Navbar from "@/components/Navbar";

interface Analysis {
  id: string;
  code: string;
  language: string | null;
  goal: string | null;
  completion_percentage: number | null;
  effort_level: string | null;
  next_steps: string[];
  risks: string[];
  confidence_score: number | null;
  created_at: string;
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Analysis | null>(null);

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
                      <span className="text-xs text-muted-foreground ml-auto">
                        {selected.confidence_score != null && `Confidence: ${Math.round(Number(selected.confidence_score) * 100)}%`}
                      </span>
                    </div>

                    <div>
                      <p className="text-primary text-xs mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> GOAL</p>
                      <p className="text-foreground">{selected.goal || "No goal detected"}</p>
                    </div>

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

                    <div>
                      <p className="text-primary text-xs mb-1 flex items-center gap-1"><Code className="w-3 h-3" /> CODE</p>
                      <pre className="bg-background/50 rounded p-3 text-xs text-muted-foreground overflow-x-auto max-h-48">
                        {selected.code}
                      </pre>
                    </div>

                    {/* Export buttons */}
                    <div className="flex gap-2 pt-3 border-t border-border">
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
