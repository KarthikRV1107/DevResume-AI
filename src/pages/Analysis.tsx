import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, X, Bot, User, RotateCcw, Maximize2, Minimize2, Package, TestTube2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/Navbar";
import Background3D from "@/components/Background3D";
import AnalysisSidebar, { type AnalysisSection } from "@/components/analysis/AnalysisSidebar";
import InputSection from "@/components/analysis/InputSection";
import OverviewSection from "@/components/analysis/OverviewSection";
import SecuritySection from "@/components/analysis/SecuritySection";
import CodeQualitySection from "@/components/analysis/CodeQualitySection";
import PerformanceSection from "@/components/analysis/PerformanceSection";
import ArchitectureSection from "@/components/analysis/ArchitectureSection";
import RiskSection from "@/components/analysis/RiskSection";
import DashboardSection from "@/components/analysis/DashboardSection";
import PlaceholderSection from "@/components/analysis/PlaceholderSection";

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

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const QUICK_PROMPTS = [
  "What's the biggest risk in this code?",
  "How can I improve performance?",
  "Suggest a better architecture",
  "Explain the main issues found",
];

const Analysis = () => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSection, setActiveSection] = useState<AnalysisSection>("input");

  const [suggestions, setSuggestions] = useState<{ title: string; code: string; explanation: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setStreamText("");
    setIsStreaming(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code, explanation_level: "Intermediate", stream: true }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Analysis failed" }));
        toast.error(err.error || "Analysis failed");
        return;
      }
      if (resp.headers.get("content-type")?.includes("text/event-stream") && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: AnalysisResult | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === "progress") setStreamText(parsed.message);
              else if (parsed.type === "result") finalResult = parsed.data;
            } catch { }
          }
        }
        if (finalResult) {
          setResult(finalResult);
          setActiveSection("overview");
          if (user) {
            supabase.from("analyses").insert({
              user_id: user.id,
              code: code.slice(0, 10000),
              language: finalResult.language,
              goal: finalResult.goal,
              completion_percentage: finalResult.completion_percentage,
              effort_level: finalResult.effort_level,
              next_steps: finalResult.next_steps as any,
              risks: finalResult.risks as any,
              issues: finalResult.issues as any,
              architectural_improvements: finalResult.architectural_improvements as any,
              confidence_score: finalResult.confidence_score,
              current_state: finalResult.current_state,
              source: finalResult.source,
            }).then(({ error }) => {
              if (!error) toast.success("Analysis saved to history!");
            });
          }
        }
      } else {
        const data = await resp.json();
        if (data?.error) { toast.error(data.error); return; }
        setResult(data);
        setActiveSection("overview");
      }
    } catch (e: any) {
      console.error("Analysis failed:", e);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const handleGetSuggestions = async () => {
    if (!result) return;
    setSuggestionsLoading(true);
    setSuggestions([]);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ code, analysis: result }),
      });
      if (!resp.ok) { toast.error("Failed to get suggestions"); return; }
      const data = await resp.json();
      setSuggestions(data.suggestions || []);
    } catch { toast.error("Failed to generate suggestions"); } finally { setSuggestionsLoading(false); }
  };

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };
    try {
      const contextMsg: ChatMsg = {
        role: "user",
        content: `Context — the user is analyzing this code:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\`\n${result ? `Analysis result: ${JSON.stringify({ goal: result.goal, next_steps: result.next_steps, risks: result.risks })}` : ""}\n\nNow answer the user's question:`,
      };
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [contextMsg, ...newMessages] }),
      });
      if (!resp.ok || !resp.body) throw new Error("Chat failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { }
        }
      }
    } catch {
      toast.error("Chat failed. Try again.");
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatMessages, chatLoading, code, result]);

  const renderSection = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground font-mono">
              {isStreaming && streamText ? streamText : "AI is deep analyzing your project..."}
            </p>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </motion.div>
        </div>
      );
    }

    switch (activeSection) {
      case "input":
        return <InputSection code={code} setCode={setCode} loading={loading} onAnalyze={handleAnalyze} onChatToggle={() => setChatOpen(!chatOpen)} />;
      case "overview":
        return result ? <OverviewSection result={result} code={code} onGetSuggestions={handleGetSuggestions} suggestionsLoading={suggestionsLoading} /> : null;
      case "code":
        return result ? <CodeQualitySection issues={result.issues} codeQualityGrade={result.code_quality_grade} architecturalImprovements={result.architectural_improvements} metrics={result.metrics} /> : null;
      case "security":
        return result ? <SecuritySection issues={result.issues} risks={result.risks} /> : null;
      case "performance":
        return result ? <PerformanceSection issues={result.issues} /> : null;
      case "architecture":
        return result ? <ArchitectureSection architecturalImprovements={result.architectural_improvements} metrics={result.metrics} /> : null;
      case "dependencies":
        return <PlaceholderSection title="Dependency Analysis" icon={Package} description="Full dependency tree analysis with vulnerability scanning." features={["Outdated libraries", "Dependency tree", "Heavy packages", "License risks"]} />;
      case "testing":
        return <PlaceholderSection title="Testing & Coverage" icon={TestTube2} description="Unit and integration test coverage analysis." features={["Coverage %", "Untested paths", "Missing tests", "Test quality"]} />;
      case "ai-insights":
        return result ? (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground font-mono">AI Insights & Recommendations</h2>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm p-5">
              <p className="text-xs text-primary font-mono mb-3">🧠 IF I WERE THE CTO...</p>
              <div className="space-y-3 text-sm text-foreground">
                <p>Based on the analysis of your {result.language} project:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">1.</span> <span><strong>Priority:</strong> Address {result.issues.filter(i => i.severity === "error").length} critical issues immediately</span></li>
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">2.</span> <span><strong>Security:</strong> {result.issues.filter(i => i.type === "security").length > 0 ? "Security vulnerabilities detected — fix before deployment" : "No major security concerns found"}</span></li>
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">3.</span> <span><strong>Architecture:</strong> {result.architectural_improvements.length > 0 ? result.architectural_improvements[0] : "Architecture looks solid"}</span></li>
                  <li className="flex items-start gap-2"><span className="text-primary font-bold">4.</span> <span><strong>Momentum:</strong> Project is {result.completion_percentage}% complete with {result.effort_level} effort remaining</span></li>
                </ul>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-5">
              <p className="text-xs text-primary font-mono mb-3">📋 IMPROVEMENT ROADMAP</p>
              <div className="space-y-2">
                {result.next_steps.map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-md border border-border bg-card/30"
                  >
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-mono font-bold ${
                      i === 0 ? "bg-destructive/20 text-destructive" : i < 3 ? "bg-yellow-500/20 text-yellow-400" : "bg-primary/20 text-primary"
                    }`}>
                      {i === 0 ? "NOW" : i < 3 ? "SOON" : "LATER"}
                    </span>
                    <span className="text-sm text-foreground">{step}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : null;
      case "risks":
        return result ? <RiskSection issues={result.issues} risks={result.risks} completionPercentage={result.completion_percentage} /> : null;
      case "dashboard":
        return result ? <DashboardSection issues={result.issues} completionPercentage={result.completion_percentage} confidenceScore={result.confidence_score} metrics={result.metrics} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col scanline relative">
      <Background3D />
      <Navbar />
      <div className="flex-1 flex overflow-hidden pt-16">
        <AnalysisSidebar activeSection={activeSection} onSectionChange={setActiveSection} hasResult={!!result} />
        <main className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full">
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 rounded-xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl glow-border overflow-hidden flex flex-col transition-all duration-300 ${
              chatExpanded ? "w-[90vw] md:w-[600px] h-[80vh]" : "w-80 md:w-96 h-[420px]"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 shrink-0">
              <span className="text-sm font-semibold text-primary flex items-center gap-2 font-mono"><Bot className="w-4 h-4" /> AI Assistant</span>
              <div className="flex items-center gap-1">
                {chatMessages.length > 0 && (
                  <button onClick={() => setChatMessages([])} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary" title="Clear chat">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setChatExpanded(!chatExpanded)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary">
                  {chatExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm text-muted-foreground text-center max-w-[200px]">Ask me anything about your code or analysis</p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} onClick={() => setChatInput(prompt)} className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all font-mono">
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${m.role === "user" ? "bg-primary/15" : "bg-accent"}`}>
                    {m.role === "user" ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-primary/15 text-foreground border border-primary/20" : "bg-secondary text-foreground border border-border"}`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:bg-card/80 [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-xs [&_code]:text-primary [&_code]:text-xs">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{m.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
              {chatLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-primary" /></div>
                  <div className="bg-secondary rounded-xl px-3.5 py-3 border border-border">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2 shrink-0 bg-card/50">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about your code..."
                className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono"
              />
              <Button variant="default" size="icon" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="shrink-0 h-10 w-10 rounded-lg bg-primary hover:bg-primary/90">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Analysis;
