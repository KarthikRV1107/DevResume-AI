import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, Zap, AlertTriangle, Brain, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sampleCode = `class PaymentHandler:
    def __init__(self):
        self.stripe = None
        self.webhook_secret = ""

    # TODO: validate webhook signature
    # TODO: handle subscription renewals
    def process(self, event):
        if event.type == "checkout.session.completed":
            pass  # need to fulfill order
        # handle refunds?`;

interface AnalysisResult {
  goal: string;
  language: string;
  current_state: string;
  completion_percentage: number;
  effort_level: string;
  next_steps: string[];
  risks: string[];
  issues: { type: string; message: string; severity: string }[];
  confidence_score: number;
  architectural_improvements: string[];
  source: string;
}

const Demo = () => {
  const [code, setCode] = useState(sampleCode);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze", {
        body: { code, explanation_level: "Intermediate" },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResult(data);
    } catch (e: any) {
      console.error("Analysis failed:", e);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="demo" className="py-24">
      <div className="container mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-4"
        >
          <span className="text-gradient">Try It</span>
        </motion.h2>
        <p className="text-center text-muted-foreground mb-12 max-w-md mx-auto">
          Paste any unfinished code and see DevResume AI recover your context with real AI analysis.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={16}
              placeholder="Paste your unfinished code here..."
              className="w-full rounded-lg border border-border bg-card p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
            <Button variant="hero" onClick={handleAnalyze} disabled={loading || !code.trim()} className="w-full">
              {loading ? <Loader2 className="animate-spin" /> : <Play />}
              {loading ? "Analyzing with AI..." : "Analyze"}
            </Button>
          </motion.div>

          {/* Output */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-lg border border-border bg-card p-6 min-h-[380px] flex items-center justify-center overflow-y-auto max-h-[600px]"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-mono">AI is analyzing your code...</p>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full space-y-5 font-mono text-sm">
                  {/* Language & Source badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      {result.language}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent-foreground border border-border">
                      {result.source === "llm-enhanced" ? "AI Enhanced" : "Static Analysis"}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Confidence: {Math.round(result.confidence_score * 100)}%
                    </span>
                  </div>

                  {/* Goal */}
                  <div>
                    <p className="text-primary text-xs mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> GOAL</p>
                    <p className="text-foreground">{result.goal}</p>
                    {result.current_state && (
                      <p className="text-muted-foreground text-xs mt-1">{result.current_state}</p>
                    )}
                  </div>

                  {/* Next Steps */}
                  <div>
                    <p className="text-primary text-xs mb-1 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> NEXT STEPS</p>
                    <ul className="space-y-1">
                      {result.next_steps.map((n, i) => (
                        <li key={i} className="text-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">▸</span> {n}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risks */}
                  <div>
                    <p className="text-primary text-xs mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> RISKS</p>
                    <ul className="space-y-1">
                      {result.risks.map((r, i) => (
                        <li key={i} className="text-yellow-400/80 flex items-start gap-2">
                          <span className="mt-0.5">⚠</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Architectural Improvements */}
                  {result.architectural_improvements && result.architectural_improvements.length > 0 && (
                    <div>
                      <p className="text-primary text-xs mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> IMPROVEMENTS</p>
                      <ul className="space-y-1">
                        {result.architectural_improvements.map((a, i) => (
                          <li key={i} className="text-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">◆</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Momentum */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-primary text-xs">MOMENTUM</p>
                      <p className="text-xs text-muted-foreground">
                        Effort: <span className={
                          result.effort_level === "High" ? "text-red-400" :
                          result.effort_level === "Medium" ? "text-yellow-400" : "text-primary"
                        }>{result.effort_level}</span>
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.completion_percentage}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{result.completion_percentage}% complete</p>
                  </div>
                </motion.div>
              ) : (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm font-mono text-center">
                  Paste code and hit Analyze to see AI-powered results.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Demo;
