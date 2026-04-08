import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Loader2, Zap, AlertTriangle, Brain, ChevronRight, MessageSquare, Send, X, Upload,
  FileCode, Trash2, Download, FileText, Sparkles, Copy, Check, Bot, User, RotateCcw,
  Maximize2, Minimize2, FolderOpen, Shield, Gauge, Boxes, Package, TestTube,
  BarChart3, TrendingUp, Eye, ChevronDown, Lock, Bug, Cpu, GitBranch, Layers, FileWarning
} from "lucide-react";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/Navbar";
import Background3D from "@/components/Background3D";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────
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

interface UploadedFile {
  name: string;
  path: string;
  content: string;
  size: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ALLOWED_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".cpp", ".c",
  ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt", ".scala", ".sh",
  ".bash", ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
  ".toml", ".xml", ".md", ".txt", ".env", ".vue", ".svelte", ".dart",
  ".r", ".m", ".mm", ".gradle", ".cmake", ".makefile", ".dockerfile",
  ".tf", ".hcl", ".proto", ".graphql", ".prisma",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 500;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

const QUICK_PROMPTS = [
  "What's the biggest risk in this code?",
  "How can I improve performance?",
  "Suggest a better architecture",
  "Explain the main issues found",
];

type AnalysisSection =
  | "overview"
  | "code"
  | "performance"
  | "security"
  | "architecture"
  | "dependencies"
  | "testing"
  | "ai-insights"
  | "risks"
  | "visualization";

const SECTIONS: { id: AnalysisSection; label: string; icon: any; color: string }[] = [
  { id: "overview", label: "Overview", icon: Eye, color: "text-primary" },
  { id: "code", label: "Code Quality", icon: FileCode, color: "text-emerald-400" },
  { id: "performance", label: "Performance", icon: Gauge, color: "text-yellow-400" },
  { id: "security", label: "Security", icon: Shield, color: "text-red-400" },
  { id: "architecture", label: "Architecture", icon: Boxes, color: "text-purple-400" },
  { id: "dependencies", label: "Dependencies", icon: Package, color: "text-blue-400" },
  { id: "testing", label: "Testing", icon: TestTube, color: "text-cyan-400" },
  { id: "ai-insights", label: "AI Insights", icon: Brain, color: "text-primary" },
  { id: "risks", label: "Risk Analysis", icon: AlertTriangle, color: "text-orange-400" },
  { id: "visualization", label: "Visualizations", icon: BarChart3, color: "text-pink-400" },
];

// ─── Component ────────────────────────────────────────────────────────
const Analysis = () => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<AnalysisSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [suggestions, setSuggestions] = useState<{ title: string; code: string; explanation: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  // ─── File Stats ─────────────────────────────────────────────────────
  const fileStats = useMemo(() => {
    const totalSize = uploadedFiles.reduce((s, f) => s + f.size, 0);
    const extensions = new Set(uploadedFiles.map(f => f.name.split(".").pop()?.toLowerCase() || ""));
    const folders = new Set(uploadedFiles.map(f => {
      const parts = f.path.split("/");
      return parts.length > 1 ? parts.slice(0, -1).join("/") : "/";
    }));
    return { totalSize, extensions: Array.from(extensions), folderCount: folders.size, fileCount: uploadedFiles.length };
  }, [uploadedFiles]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── File Processing ────────────────────────────────────────────────
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const totalAfter = uploadedFiles.length + fileArray.length;
    if (totalAfter > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed. You're trying to add ${fileArray.length} to ${uploadedFiles.length} existing.`);
      return;
    }

    const newFiles: UploadedFile[] = [];
    let skippedCount = 0;

    for (const file of fileArray) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) { skippedCount++; continue; }
      if (file.size > MAX_FILE_SIZE) { skippedCount++; continue; }
      if (file.size === 0) continue;

      const currentTotal = uploadedFiles.reduce((s, f) => s + f.size, 0) + newFiles.reduce((s, f) => s + f.size, 0);
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        toast.error("Total project size exceeds 50MB limit");
        break;
      }

      try {
        const content = await file.text();
        const path = (file as any).webkitRelativePath || file.name;
        newFiles.push({ name: file.name, path, content, size: file.size });
      } catch {
        skippedCount++;
      }
    }

    if (newFiles.length > 0) {
      const all = [...uploadedFiles, ...newFiles];
      setUploadedFiles(all);
      const combined = all.map(f => `// ═══ ${f.path} ═══\n${f.content}`).join("\n\n");
      setCode(combined);
      toast.success(`${newFiles.length} file(s) loaded${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`);
    } else if (skippedCount > 0) {
      toast.error(`${skippedCount} file(s) skipped (unsupported type or too large)`);
    }
  }, [uploadedFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    if (items) {
      const entries: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      if (entries.some(e => e.isDirectory)) {
        readDirectoryEntries(entries);
        return;
      }
    }
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const readDirectoryEntries = async (entries: any[]) => {
    const files: File[] = [];
    const readEntry = async (entry: any, path = ""): Promise<void> => {
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve));
        Object.defineProperty(file, "webkitRelativePath", { value: path + file.name });
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const subEntries: any[] = await new Promise((resolve) => reader.readEntries(resolve));
        for (const sub of subEntries) {
          await readEntry(sub, path + entry.name + "/");
        }
      }
    };
    for (const entry of entries) await readEntry(entry);
    if (files.length > 0) processFiles(files);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const removeFile = useCallback((index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    if (updated.length === 0) setCode("");
    else setCode(updated.map(f => `// ═══ ${f.path} ═══\n${f.content}`).join("\n\n"));
  }, [uploadedFiles]);

  const clearAllFiles = useCallback(() => { setUploadedFiles([]); setCode(""); }, []);

  // ─── Analysis ───────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setStreamText("");
    setIsStreaming(true);
    try {
      const analysisCode = code.slice(0, 500000); // Send up to 500KB to edge function
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code: analysisCode, explanation_level: "Intermediate", stream: true }),
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
            } catch {}
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
      }
    } catch (e: any) {
      console.error("Analysis failed:", e);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  // ─── Chat ───────────────────────────────────────────────────────────
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
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };
    try {
      const contextMsg: ChatMsg = {
        role: "user",
        content: `Context — analyzing project with ${fileStats.fileCount} files (${formatSize(fileStats.totalSize)}):\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\`\n${result ? `Analysis: ${JSON.stringify({ goal: result.goal, next_steps: result.next_steps, risks: result.risks })}` : ""}\n\nAnswer:`,
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
          } catch {}
        }
      }
    } catch {
      toast.error("Chat failed. Try again.");
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatMessages, chatLoading, code, result, fileStats]);

  // ─── Computed analysis data for sections ────────────────────────────
  const securityIssues = useMemo(() => result?.issues.filter(i => i.type === "security") || [], [result]);
  const performanceIssues = useMemo(() => result?.issues.filter(i => i.type === "performance") || [], [result]);
  const codeIssues = useMemo(() => result?.issues.filter(i => ["complexity", "naming", "dead_code", "documentation", "empty_function"].includes(i.type)) || [], [result]);
  const errorHandlingIssues = useMemo(() => result?.issues.filter(i => i.type === "error_handling") || [], [result]);

  const riskScore = useMemo(() => {
    if (!result) return 0;
    const errors = result.issues.filter(i => i.severity === "error").length;
    const warnings = result.issues.filter(i => i.severity === "warning").length;
    return Math.min(100, errors * 15 + warnings * 5);
  }, [result]);

  const securityScore = useMemo(() => Math.max(0, 100 - securityIssues.length * 20), [securityIssues]);
  const performanceScore = useMemo(() => Math.max(0, 100 - performanceIssues.length * 15), [performanceIssues]);

  // ─── Render helpers ─────────────────────────────────────────────────
  const IssueCard = ({ issue, index }: { issue: { type: string; message: string; severity: string; line?: number }; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`rounded-lg border p-3 text-xs ${
        issue.severity === "error" ? "border-destructive/30 bg-destructive/5" :
        issue.severity === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
        "border-border bg-card/50"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 ${
          issue.severity === "error" ? "text-destructive" :
          issue.severity === "warning" ? "text-yellow-400" : "text-muted-foreground"
        }`}>
          {issue.severity === "error" ? <Bug className="w-3.5 h-3.5" /> : issue.severity === "warning" ? <AlertTriangle className="w-3.5 h-3.5" /> : <FileWarning className="w-3.5 h-3.5" />}
        </span>
        <div className="flex-1">
          <span className="text-foreground">{issue.message}</span>
          {issue.line && <span className="text-muted-foreground ml-2">Line {issue.line}</span>}
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
          issue.severity === "error" ? "bg-destructive/20 text-destructive" :
          issue.severity === "warning" ? "bg-yellow-500/20 text-yellow-400" : "bg-muted text-muted-foreground"
        }`}>{issue.type}</span>
      </div>
    </motion.div>
  );

  const ScoreGauge = ({ score, label, color }: { score: number; label: string; color: string }) => (
    <div className="text-center space-y-2">
      <div className="relative w-20 h-20 mx-auto">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="35" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle cx="40" cy="40" r="35" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${(score / 100) * 220} 220`} strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">{score}</span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );

  // ─── Section Content ────────────────────────────────────────────────
  const renderSection = () => {
    if (!result) return null;

    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Language", value: result.language, icon: FileCode },
                { label: "Files", value: `${fileStats.fileCount}`, icon: FolderOpen },
                { label: "Total Lines", value: `${result.metrics?.total_lines || 0}`, icon: Layers },
                { label: "Quality Grade", value: result.code_quality_grade || "N/A", icon: TrendingUp },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4 text-center">
                  <stat.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <ScoreGauge score={result.completion_percentage} label="Completion" color="hsl(142, 71%, 45%)" />
              <ScoreGauge score={securityScore} label="Security" color={securityScore > 70 ? "hsl(142, 71%, 45%)" : securityScore > 40 ? "hsl(45, 93%, 47%)" : "hsl(0, 84%, 60%)"} />
              <ScoreGauge score={performanceScore} label="Performance" color="hsl(185, 70%, 50%)" />
            </div>

            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4 space-y-2">
              <p className="text-primary text-xs font-semibold flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> PROJECT GOAL</p>
              <p className="text-sm text-foreground">{result.goal}</p>
              {result.current_state && <p className="text-xs text-muted-foreground">{result.current_state}</p>}
            </div>

            {result.highlights && result.highlights.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-primary text-xs font-semibold">✅ STRENGTHS</p>
                <ul className="space-y-1">{result.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2"><span className="text-primary mt-0.5">✓</span> {h}</li>
                ))}</ul>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-primary text-xs font-semibold">MOMENTUM</p>
                <span className={`text-xs ${result.effort_level === "High" ? "text-destructive" : result.effort_level === "Medium" ? "text-yellow-400" : "text-primary"}`}>
                  Effort: {result.effort_level}
                </span>
              </div>
              <Progress value={result.completion_percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">{result.completion_percentage}% complete · Confidence: {Math.round(result.confidence_score * 100)}%</p>
            </div>

            {result.metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Code Lines", value: result.metrics.code_lines },
                  { label: "Functions", value: result.metrics.functions },
                  { label: "Classes", value: result.metrics.classes },
                  { label: "Comment %", value: `${result.metrics.comment_ratio}%` },
                ].map((m, i) => (
                  <div key={i} className="rounded border border-border bg-card/50 p-3 text-center">
                    <p className="text-lg font-mono font-bold text-foreground">{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "code":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-2xl font-bold ${
                result.code_quality_grade === "A" ? "text-primary" :
                result.code_quality_grade === "B" ? "text-emerald-400" :
                result.code_quality_grade === "C" ? "text-yellow-400" : "text-destructive"
              }`}>Grade: {result.code_quality_grade || "N/A"}</span>
              <span className="text-xs text-muted-foreground">({codeIssues.length} issues found)</span>
            </div>
            {codeIssues.length > 0 ? codeIssues.map((issue, i) => <IssueCard key={i} issue={issue} index={i} />) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No code quality issues detected ✨</div>
            )}
            {errorHandlingIssues.length > 0 && (
              <>
                <p className="text-xs text-primary font-semibold mt-4">ERROR HANDLING</p>
                {errorHandlingIssues.map((issue, i) => <IssueCard key={i} issue={issue} index={i} />)}
              </>
            )}
          </div>
        );

      case "performance":
        return (
          <div className="space-y-4">
            <ScoreGauge score={performanceScore} label="Performance Score" color="hsl(185, 70%, 50%)" />
            {performanceIssues.length > 0 ? performanceIssues.map((issue, i) => <IssueCard key={i} issue={issue} index={i} />) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No performance issues detected ⚡</div>
            )}
            <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
              <p className="text-xs text-primary font-semibold">💡 OPTIMIZATION TIPS</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Consider lazy loading for large modules</li>
                <li>• Cache expensive computations with memoization</li>
                <li>• Use pagination for large data sets</li>
                <li>• Profile bottlenecks before optimizing</li>
              </ul>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <ScoreGauge score={securityScore} label="Security Score" color={securityScore > 70 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Security Analysis
                </p>
                <p className="text-xs text-muted-foreground">
                  {securityIssues.length === 0 ? "No vulnerabilities detected" : `${securityIssues.length} potential vulnerability(ies) found`}
                </p>
              </div>
            </div>
            {securityIssues.map((issue, i) => <IssueCard key={i} issue={issue} index={i} />)}
            <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
              <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><Lock className="w-3 h-3" /> OWASP CHECK</p>
              {["SQL Injection", "XSS", "CSRF", "Hardcoded Secrets", "Insecure Auth"].map((check, i) => {
                const found = securityIssues.some(iss => iss.message.toLowerCase().includes(check.toLowerCase().split(" ")[0]));
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={found ? "text-destructive" : "text-primary"}>{found ? "⚠" : "✓"}</span>
                    <span className={found ? "text-destructive" : "text-muted-foreground"}>{check}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "architecture":
        return (
          <div className="space-y-4">
            {result.architectural_improvements?.length > 0 ? (
              <>
                <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><Boxes className="w-3.5 h-3.5" /> ARCHITECTURE IMPROVEMENTS</p>
                {result.architectural_improvements.map((imp, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="rounded-lg border border-border bg-card/50 p-3 text-xs text-foreground flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> {imp}
                  </motion.div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">Architecture looks solid 🏗️</div>
            )}
            <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
              <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><GitBranch className="w-3 h-3" /> PROJECT STRUCTURE</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📁 {fileStats.folderCount} folder(s) · {fileStats.fileCount} file(s)</p>
                <p>📦 Extensions: {fileStats.extensions.join(", ") || "N/A"}</p>
                <p>📏 Total size: {formatSize(fileStats.totalSize)}</p>
              </div>
            </div>
          </div>
        );

      case "dependencies":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
              <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> DEPENDENCY OVERVIEW</p>
              <p className="text-xs text-muted-foreground">{result.metrics?.imports || 0} import statements detected</p>
            </div>
            {result.issues.filter(i => i.message.toLowerCase().includes("import") || i.message.toLowerCase().includes("require") || i.message.toLowerCase().includes("depend")).map((issue, i) => (
              <IssueCard key={i} issue={issue} index={i} />
            ))}
            <div className="text-center py-4 text-muted-foreground text-xs">
              Upload a full project with package.json / requirements.txt for detailed dependency analysis
            </div>
          </div>
        );

      case "testing":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
              <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><TestTube className="w-3.5 h-3.5" /> TEST COVERAGE</p>
              {code.includes("test(") || code.includes("it(") || code.includes("describe(") ? (
                <p className="text-xs text-primary">Tests detected in codebase ✓</p>
              ) : (
                <p className="text-xs text-yellow-400">⚠ No tests detected — consider adding unit tests</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
              <p className="text-xs text-primary font-semibold">SUGGESTED TESTS</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.next_steps.filter(s => s.toLowerCase().includes("test")).length > 0
                  ? result.next_steps.filter(s => s.toLowerCase().includes("test")).map((s, i) => <li key={i}>• {s}</li>)
                  : <>
                    <li>• Add unit tests for core business logic</li>
                    <li>• Add integration tests for API endpoints</li>
                    <li>• Test edge cases and error handling paths</li>
                  </>
                }
              </ul>
            </div>
          </div>
        );

      case "ai-insights":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> AI ASSESSMENT</p>
              <p className="text-sm text-foreground">{result.current_state}</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded ${result.source === "llm-enhanced" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {result.source === "llm-enhanced" ? "✨ AI Enhanced" : "Static Analysis"}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /> RECOMMENDED NEXT STEPS</p>
              {result.next_steps.map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="rounded border border-border bg-card/50 p-3 text-xs text-foreground flex items-start gap-2">
                  <span className="text-primary shrink-0">▸</span> {step}
                </motion.div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => exportAsMarkdown({ ...result, code, created_at: new Date().toISOString() })} className="flex-1 text-xs">
                <FileText className="w-3 h-3" /> Export .md
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportAsPDF({ ...result, code, created_at: new Date().toISOString() })} className="flex-1 text-xs">
                <Download className="w-3 h-3" /> Export PDF
              </Button>
              <Button variant="hero" size="sm" disabled={suggestionsLoading}
                onClick={async () => {
                  setSuggestionsLoading(true);
                  setSuggestions([]);
                  try {
                    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                      body: JSON.stringify({ code: code.slice(0, 15000), analysis: result }),
                    });
                    if (!resp.ok) { toast.error("Failed to get suggestions"); return; }
                    const data = await resp.json();
                    setSuggestions(data.suggestions || []);
                  } catch { toast.error("Failed to generate suggestions"); } finally { setSuggestionsLoading(false); }
                }}
                className="flex-1 text-xs"
              >
                {suggestionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {suggestionsLoading ? "Generating..." : "AI Fixes"}
              </Button>
            </div>

            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2">
                  <p className="text-primary text-xs flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI SUGGESTIONS</p>
                  {suggestions.map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">{s.title}</p>
                        <button onClick={() => { navigator.clipboard.writeText(s.code); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); toast.success("Copied!"); }}
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <pre className="text-[11px] text-muted-foreground bg-card/80 rounded p-2 overflow-x-auto max-h-32">{s.code}</pre>
                      <p className="text-[11px] text-muted-foreground/80 italic">{s.explanation}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case "risks":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{riskScore}</p>
                <p className="text-[10px] text-muted-foreground">Risk Score</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{100 - result.completion_percentage}</p>
                <p className="text-[10px] text-muted-foreground">Tech Debt</p>
              </div>
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{Math.round(result.confidence_score * 100)}</p>
                <p className="text-[10px] text-muted-foreground">Maintainability</p>
              </div>
            </div>

            {result.risks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-primary font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> IDENTIFIED RISKS</p>
                {result.risks.map((r, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-400 flex items-start gap-2">
                    <span className="mt-0.5">⚠</span> {r}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        );

      case "visualization":
        return (
          <div className="space-y-4">
            <p className="text-xs text-primary font-semibold">ISSUE DISTRIBUTION</p>
            {(() => {
              const types = result.issues.reduce<Record<string, number>>((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {});
              const maxCount = Math.max(...Object.values(types), 1);
              return Object.entries(types).sort((a, b) => b[1] - a[1]).map(([type, count], i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{type}</span>
                  <div className="flex-1 h-5 bg-secondary rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxCount) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="h-full rounded"
                      style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(185, 70%, 50%))" }}
                    />
                  </div>
                  <span className="text-xs text-foreground font-mono w-8">{count}</span>
                </div>
              ));
            })()}

            <p className="text-xs text-primary font-semibold mt-6">SEVERITY BREAKDOWN</p>
            {["error", "warning", "info"].map((sev, i) => {
              const count = result.issues.filter(iss => iss.severity === sev).length;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs w-20 shrink-0 text-right ${sev === "error" ? "text-destructive" : sev === "warning" ? "text-yellow-400" : "text-muted-foreground"}`}>{sev}</span>
                  <div className="flex-1 h-5 bg-secondary rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / Math.max(result.issues.length, 1)) * 100}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded ${sev === "error" ? "bg-destructive" : sev === "warning" ? "bg-yellow-500" : "bg-muted-foreground"}`}
                    />
                  </div>
                  <span className="text-xs text-foreground font-mono w-8">{count}</span>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Layout ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen scanline relative">
      <Background3D />
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-bold mb-3">
              <span className="text-gradient">Project Analysis Engine</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
              Upload entire project folders — analyze architecture, security, performance, and code quality at scale.
            </p>
          </motion.div>

          {/* Upload Area */}
          {!result && !loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-4 mb-8">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`rounded-xl border-2 border-dashed p-8 md:p-12 text-center cursor-pointer transition-all ${
                  isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50"
                }`}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-primary/60" />
                <p className="text-lg font-semibold text-foreground mb-1">Drop project folder or files here</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports 500+ files · Up to 5MB per file · 50MB total
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="hero" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}>
                    <FolderOpen className="w-4 h-4" /> Upload Folder
                  </Button>
                  <Button variant="hero-outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <FileCode className="w-4 h-4" /> Upload Files
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-3">
                  .js .ts .py .go .rs .java .cpp .c .cs .rb .php .swift .kt .html .css .json .yaml + more
                </p>
                <input ref={fileInputRef} type="file" multiple accept={ALLOWED_EXTENSIONS.join(",")} className="hidden"
                  onChange={e => e.target.files && processFiles(e.target.files)} />
                <input ref={folderInputRef} type="file" multiple className="hidden"
                  {...{ webkitdirectory: "", directory: "" } as any}
                  onChange={e => e.target.files && processFiles(e.target.files)} />
              </div>

              {/* Or paste code */}
              <div className="text-center text-xs text-muted-foreground">— or paste code directly —</div>
              <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                  <span className="w-3 h-3 rounded-full bg-destructive/70" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <span className="w-3 h-3 rounded-full bg-primary/70" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">editor</span>
                </div>
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Paste your code here..."
                  className="w-full bg-transparent p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none leading-relaxed min-h-[200px]"
                  spellCheck={false}
                />
              </div>
            </motion.div>
          )}

          {/* File list */}
          {uploadedFiles.length > 0 && !result && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-muted-foreground">
                  <span className="text-foreground font-semibold">{fileStats.fileCount}</span> files ·{" "}
                  <span className="text-foreground font-semibold">{fileStats.folderCount}</span> folders ·{" "}
                  <span className="text-foreground font-semibold">{formatSize(fileStats.totalSize)}</span>
                </div>
                <button onClick={clearAllFiles} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {uploadedFiles.slice(0, 50).map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                    <FileCode className="w-2.5 h-2.5" /> {f.path.length > 30 ? "..." + f.path.slice(-30) : f.path}
                    <button onClick={() => removeFile(i)} className="hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
                {uploadedFiles.length > 50 && (
                  <span className="text-[10px] text-muted-foreground px-2 py-0.5">+{uploadedFiles.length - 50} more</span>
                )}
              </div>
            </motion.div>
          )}

          {/* Analyze button (pre-result) */}
          {!result && !loading && code.trim() && (
            <div className="max-w-5xl mx-auto flex gap-3 mb-8">
              <Button variant="hero" onClick={handleAnalyze} className="flex-1 h-12 text-base">
                <Play className="w-5 h-5" /> Analyze Project
              </Button>
              <Button variant="hero-outline" onClick={() => setChatOpen(!chatOpen)} className="gap-2 h-12">
                <MessageSquare className="w-4 h-4" /> Chat
              </Button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto text-center space-y-4 py-16">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground font-mono">
                {isStreaming && streamText ? streamText : "AI is analyzing your project..."}
              </p>
              <div className="flex gap-1 justify-center">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Dashboard with sidebar */}
          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 max-w-[95rem] mx-auto">
              {/* Sidebar */}
              <div className={`shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-12" : "w-48"}`}>
                <div className="sticky top-24 rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                  <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="w-full flex items-center justify-center p-2 border-b border-border hover:bg-primary/5 transition-colors">
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${sidebarCollapsed ? "-rotate-90" : ""}`} />
                  </button>
                  <nav className="p-1.5 space-y-0.5">
                    {SECTIONS.map(sec => (
                      <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all ${
                          activeSection === sec.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                        title={sidebarCollapsed ? sec.label : undefined}
                      >
                        <sec.icon className={`w-4 h-4 shrink-0 ${activeSection === sec.id ? "text-primary" : sec.color}`} />
                        {!sidebarCollapsed && <span className="truncate">{sec.label}</span>}
                      </button>
                    ))}
                  </nav>

                  {!sidebarCollapsed && (
                    <div className="border-t border-border p-2 space-y-1.5">
                      <Button variant="outline" size="sm" className="w-full text-[10px] h-7" onClick={() => { setResult(null); setActiveSection("overview"); }}>
                        <RotateCcw className="w-3 h-3" /> New Analysis
                      </Button>
                      <Button variant="outline" size="sm" className="w-full text-[10px] h-7" onClick={() => setChatOpen(!chatOpen)}>
                        <MessageSquare className="w-3 h-3" /> AI Chat
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 min-h-[600px]">
                  <div className="flex items-center gap-2 mb-6">
                    {(() => {
                      const sec = SECTIONS.find(s => s.id === activeSection);
                      return sec ? (
                        <>
                          <sec.icon className={`w-5 h-5 ${sec.color}`} />
                          <h2 className="text-lg font-bold text-foreground">{sec.label}</h2>
                        </>
                      ) : null;
                    })()}
                    <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{result.language}</span>
                      <span>{result.source === "llm-enhanced" ? "✨ AI" : "Static"}</span>
                    </div>
                  </div>
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    {renderSection()}
                  </ScrollArea>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

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
              <span className="text-sm font-semibold text-primary flex items-center gap-2"><Bot className="w-4 h-4" /> AI Code Assistant</span>
              <div className="flex items-center gap-1">
                {chatMessages.length > 0 && (
                  <button onClick={() => setChatMessages([])} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary"><RotateCcw className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={() => setChatExpanded(!chatExpanded)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary">
                  {chatExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm text-muted-foreground text-center max-w-[200px]">Ask me anything about your project</p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        onClick={() => setChatInput(prompt)}
                        className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all">
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
                    ) : <p className="text-sm">{m.content}</p>}
                  </div>
                </motion.div>
              ))}
              {chatLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-primary" /></div>
                  <div className="bg-secondary rounded-xl px-3.5 py-3 border border-border">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />)}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2 shrink-0 bg-card/50">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about your project..." className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50 transition-all" />
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
