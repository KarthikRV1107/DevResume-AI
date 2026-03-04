import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  next: string[];
  risks: string[];
  momentum: number;
}

const analyzeCode = (code: string): AnalysisResult => {
  const todos = (code.match(/TODO/gi) || []).length;
  const passes = (code.match(/pass\b/g) || []).length;
  const questions = (code.match(/\?/g) || []).length;
  const lines = code.split("\n").filter((l) => l.trim()).length;
  const implemented = Math.max(10, Math.min(80, Math.round(((lines - todos - passes) / Math.max(lines, 1)) * 100)));

  // Extract class/function names for goal
  const classMatch = code.match(/class\s+(\w+)/);
  const funcMatches = code.match(/def\s+(\w+)/g) || [];
  const goal = classMatch
    ? `Build ${classMatch[1]} with ${funcMatches.length} method(s)`
    : "Complete the code module";

  const next: string[] = [];
  const todoLines = code.match(/#\s*TODO:?\s*(.*)/gi) || [];
  todoLines.forEach((t) => {
    const task = t.replace(/#\s*TODO:?\s*/i, "").trim();
    if (task) next.push(task.charAt(0).toUpperCase() + task.slice(1));
  });
  if (passes > 0) next.push("Implement placeholder pass statements");
  if (next.length === 0) next.push("Review and refactor existing logic");

  const risks: string[] = [];
  if (questions > 0) risks.push(`${questions} unresolved question(s) in comments`);
  if (passes > 0) risks.push(`${passes} unimplemented stub(s)`);
  if (code.includes("secret") || code.includes("key")) risks.push("Hardcoded secrets detected");
  if (risks.length === 0) risks.push("No critical risks found");

  return { goal, next: next.slice(0, 4), risks: risks.slice(0, 3), momentum: implemented };
};

const Demo = () => {
  const [code, setCode] = useState(sampleCode);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult(analyzeCode(code));
      setLoading(false);
    }, 1200);
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
          Paste any unfinished code and see DevResume AI recover your context.
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
              {loading ? "Analyzing..." : "Analyze"}
            </Button>
          </motion.div>

          {/* Output */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-lg border border-border bg-card p-6 min-h-[380px] flex items-center justify-center"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-mono">Scanning code...</p>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full space-y-5 font-mono text-sm">
                  <div>
                    <p className="text-primary text-xs mb-1">GOAL</p>
                    <p className="text-foreground">{result.goal}</p>
                  </div>
                  <div>
                    <p className="text-primary text-xs mb-1">NEXT STEPS</p>
                    <ul className="space-y-1">
                      {result.next.map((n, i) => (
                        <li key={i} className="text-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">▸</span> {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-primary text-xs mb-1">RISKS</p>
                    <ul className="space-y-1">
                      {result.risks.map((r, i) => (
                        <li key={i} className="text-yellow-400/80 flex items-start gap-2">
                          <span className="mt-0.5">⚠</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-primary text-xs mb-1">MOMENTUM</p>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.momentum}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{result.momentum}% complete</p>
                  </div>
                </motion.div>
              ) : (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm font-mono text-center">
                  Paste code and hit Analyze to see results.
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
