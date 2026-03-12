import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, Zap, AlertTriangle, Brain, ChevronRight, MessageSquare, Send, X, Upload, FileCode, Trash2, Download, FileText, Sparkles, Copy, Check, Bot, User, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<{ title: string; code: string; explanation: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

  const QUICK_PROMPTS = [
    "What's the biggest risk in this code?",
    "How can I improve performance?",
    "Suggest a better architecture",
    "Explain the main issues found",
  ];

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
      setCode("");
    } else {
      const combined = updated
        .map((f) => `// ═══ ${f.name} ═══\n${f.content}`)
        .join("\n\n");
      setCode(combined);
    }
  }, [uploadedFiles]);

  const clearAllFiles = useCallback(() => {
    setUploadedFiles([]);
    setCode("");
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
            {/* File upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Drop files here or <span className="text-primary">browse</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                .js .ts .py .go .rs .java .cpp + more · Max 100KB each · Up to 10 files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-mono"
                  >
                    <FileCode className="w-3 h-3" />
                    {f.name}
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={clearAllFiles}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
              </div>
            )}

            {/* Code editor */}
            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                <span className="w-3 h-3 rounded-full bg-destructive/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-primary/70" />
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  {uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s)` : "editor"}
                </span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={12}
                placeholder="Paste your unfinished code here or upload files above..."
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

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportAsMarkdown({ ...result, code, created_at: new Date().toISOString() })}
                      className="flex-1 text-xs"
                    >
                      <FileText className="w-3 h-3" /> Export .md
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportAsPDF({ ...result, code, created_at: new Date().toISOString() })}
                      className="flex-1 text-xs"
                    >
                      <Download className="w-3 h-3" /> Export PDF
                    </Button>
                    <Button
                      variant="hero"
                      size="sm"
                      disabled={suggestionsLoading}
                      onClick={async () => {
                        setSuggestionsLoading(true);
                        setSuggestions([]);
                        try {
                          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                            },
                            body: JSON.stringify({ code, analysis: result }),
                          });
                          if (!resp.ok) {
                            const err = await resp.json().catch(() => ({ error: "Failed" }));
                            toast.error(err.error || "Failed to get suggestions");
                            return;
                          }
                          const data = await resp.json();
                          setSuggestions(data.suggestions || []);
                        } catch {
                          toast.error("Failed to generate suggestions");
                        } finally {
                          setSuggestionsLoading(false);
                        }
                      }}
                      className="flex-1 text-xs"
                    >
                      {suggestionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {suggestionsLoading ? "Generating..." : "AI Fixes"}
                    </Button>
                  </div>

                  {/* AI Suggestions */}
                  <AnimatePresence>
                    {suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-2"
                      >
                        <p className="text-primary text-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI SUGGESTIONS
                        </p>
                        {suggestions.map((s, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="rounded-md border border-border bg-background/50 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-foreground">{s.title}</p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(s.code);
                                  setCopiedIdx(i);
                                  setTimeout(() => setCopiedIdx(null), 2000);
                                  toast.success("Copied to clipboard!");
                                }}
                                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                              >
                                {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <pre className="text-[11px] text-muted-foreground bg-card/80 rounded p-2 overflow-x-auto max-h-32">
                              {s.code}
                            </pre>
                            <p className="text-[11px] text-muted-foreground/80 italic">{s.explanation}</p>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
            className={`fixed bottom-6 right-6 z-50 rounded-xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl glow-border overflow-hidden flex flex-col transition-all duration-300 ${
              chatExpanded ? "w-[90vw] md:w-[600px] h-[80vh]" : "w-80 md:w-96 h-[420px]"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 shrink-0">
              <span className="text-sm font-semibold text-primary flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Code Assistant
              </span>
              <div className="flex items-center gap-1">
                {chatMessages.length > 0 && (
                  <button
                    onClick={() => { setChatMessages([]); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
                    title="Clear chat"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setChatExpanded(!chatExpanded)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
                  title={chatExpanded ? "Minimize" : "Expand"}
                >
                  {chatExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-[200px]">
                    Ask me anything about your code or analysis results
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => {
                          setChatInput(prompt);
                        }}
                        className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all"
                      >
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                    m.role === "user" ? "bg-primary/15" : "bg-accent"
                  }`}>
                    {m.role === "user" ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary/15 text-foreground border border-primary/20"
                      : "bg-secondary text-foreground border border-border"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:bg-card/80 [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-xs [&_code]:text-primary [&_code]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
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
                  <div className="shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-xl px-3.5 py-3 border border-border">
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
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2 shrink-0 bg-card/50">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about your code..."
                className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <Button
                variant="default"
                size="icon"
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="shrink-0 h-10 w-10 rounded-lg bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Demo;
