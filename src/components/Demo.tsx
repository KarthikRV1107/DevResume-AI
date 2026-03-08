import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, Zap, AlertTriangle, Brain, ChevronRight, MessageSquare, Send, X, Upload, FileCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface UploadedFile {
  name: string;
  content: string;
}

const ALLOWED_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".cpp", ".c",
  ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt", ".scala", ".sh",
  ".bash", ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
  ".toml", ".xml", ".md", ".txt", ".env", ".vue", ".svelte",
];

const MAX_FILE_SIZE = 100 * 1024; // 100KB per file
const MAX_FILES = 10;

const Demo = () => {
  const { user } = useAuth();
  const [code, setCode] = useState(sampleCode);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const totalAfter = uploadedFiles.length + fileArray.length;
    if (totalAfter > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const newFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file type: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large (>100KB): ${file.name}`);
        continue;
      }
      try {
        const content = await file.text();
        newFiles.push({ name: file.name, content });
      } catch {
        toast.error(`Failed to read: ${file.name}`);
      }
    }

    if (newFiles.length > 0) {
      const all = [...uploadedFiles, ...newFiles];
      setUploadedFiles(all);
      // Combine all files into the code editor
      const combined = all
        .map((f) => `// ═══ ${f.name} ═══\n${f.content}`)
        .join("\n\n");
      setCode(combined);
      toast.success(`${newFiles.length} file(s) loaded`);
    }
  }, [uploadedFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    if (updated.length === 0) {
      setCode(sampleCode);
    } else {
      const combined = updated
        .map((f) => `// ═══ ${f.name} ═══\n${f.content}`)
        .join("\n\n");
      setCode(combined);
    }
  }, [uploadedFiles]);

  const clearAllFiles = useCallback(() => {
    setUploadedFiles([]);
    setCode(sampleCode);
  }, []);

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
        // Stream SSE
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
              if (parsed.type === "progress") {
                setStreamText(parsed.message);
              } else if (parsed.type === "result") {
                finalResult = parsed.data;
              }
            } catch { /* partial JSON, wait */ }
          }
        }

        if (finalResult) {
          setResult(finalResult);
          // Save to history for logged-in users
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
        // Non-streaming fallback
        const data = await resp.json();
        if (data?.error) {
          toast.error(data.error);
          return;
        }
        setResult(data);
      }
    } catch (e: any) {
      console.error("Analysis failed:", e);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  // Chat with AI about the code
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
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
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
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Chat failed. Try again.");
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatMessages, chatLoading, code, result]);

  return (
    <section id="demo" className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-gradient">Try It Live</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Paste any unfinished code — watch AI recover your context in real time.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                <span className="w-3 h-3 rounded-full bg-destructive/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-primary/70" />
                <span className="ml-2 text-xs text-muted-foreground font-mono">editor</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={14}
                placeholder="Paste your unfinished code here..."
                className="w-full bg-transparent p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="hero" onClick={handleAnalyze} disabled={loading || !code.trim()} className="flex-1">
                {loading ? <Loader2 className="animate-spin" /> : <Play />}
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
              <Button
                variant="hero-outline"
                onClick={() => setChatOpen(!chatOpen)}
                className="gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </Button>
            </div>
          </motion.div>

          {/* Output */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6 min-h-[380px] flex items-center justify-center overflow-y-auto max-h-[600px]"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground font-mono">
                    {isStreaming && streamText ? streamText : "AI is analyzing your code..."}
                  </p>
                  <div className="flex gap-1 justify-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full space-y-5 font-mono text-sm">
                  {/* Language & Source badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      {result.language}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent-foreground border border-border">
                      {result.source === "llm-enhanced" ? "✨ AI Enhanced" : "Static Analysis"}
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
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="text-foreground flex items-start gap-2"
                        >
                          <span className="text-primary mt-0.5">▸</span> {n}
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* Risks */}
                  {result.risks.length > 0 && (
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
                  )}

                  {/* Architectural Improvements */}
                  {result.architectural_improvements?.length > 0 && (
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
                          result.effort_level === "High" ? "text-destructive" :
                          result.effort_level === "Medium" ? "text-yellow-400" : "text-primary"
                        }>{result.effort_level}</span>
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${result.completion_percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, hsl(142 71% 45%), hsl(185 70% 50%))`,
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{result.completion_percentage}% complete</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
                  <Brain className="w-10 h-10 text-primary/30 mx-auto" />
                  <p className="text-muted-foreground text-sm font-mono">
                    Paste code and hit Analyze for AI-powered results.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-80 md:w-96 z-50 rounded-lg border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl glow-border overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
              <span className="text-sm font-mono text-primary flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Ask about your code
              </span>
              <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-64 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8 font-mono">
                  Ask follow-up questions about your code analysis...
                </p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs font-mono ${
                    m.role === "user"
                      ? "bg-primary/20 text-foreground border border-primary/20"
                      : "bg-secondary text-foreground border border-border"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-lg px-3 py-2 border border-border">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-border p-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground px-3 py-2 rounded border border-border focus:outline-none focus:border-primary/50"
              />
              <Button variant="ghost" size="icon" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="shrink-0 h-8 w-8">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Demo;
