import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Loader2, Zap, AlertTriangle, Brain, ChevronRight, MessageSquare, Send, X,
  Upload, FileCode, Trash2, Download, FileText, Sparkles, Copy, Check, Bot, User,
  RotateCcw, Maximize2, Minimize2, FolderOpen, Folder, File, ChevronDown, ChevronUp,
  ArrowLeft,
} from "lucide-react";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/Navbar";
import Background3D from "@/components/Background3D";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

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

interface UploadedFile {
  name: string;
  path: string;
  content: string;
  size: number;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  files: UploadedFile[];
  isOpen: boolean;
}

const ALLOWED_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".cpp", ".c",
  ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt", ".scala", ".sh",
  ".bash", ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
  ".toml", ".xml", ".md", ".txt", ".env", ".vue", ".svelte",
];

const IGNORED_DIRS = [
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".cache", ".vscode", ".idea", "vendor", "target", "bin", "obj",
  ".DS_Store", "coverage", ".nyc_output",
];

const MAX_FILE_SIZE = 200 * 1024; // 200KB per file
const MAX_FILES = 50;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total

const QUICK_PROMPTS = [
  "What's the biggest risk in this code?",
  "How can I improve performance?",
  "Suggest a better architecture",
  "Explain the main issues found",
];

function buildFileTree(files: UploadedFile[]): FolderNode {
  const root: FolderNode = { name: "Project", path: "", children: [], files: [], isOpen: true };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let child = current.children.find((c) => c.name === folderName);
      if (!child) {
        child = { name: folderName, path: parts.slice(0, i + 1).join("/"), children: [], files: [], isOpen: true };
        current.children.push(child);
      }
      current = child;
    }
    current.files.push(file);
  }

  return root;
}

function FileTreeNode({
  node,
  depth,
  onToggle,
  onRemoveFile,
  selectedFile,
  onSelectFile,
}: {
  node: FolderNode;
  depth: number;
  onToggle: (path: string) => void;
  onRemoveFile: (path: string) => void;
  selectedFile: string | null;
  onSelectFile: (file: UploadedFile) => void;
}) {
  return (
    <div>
      {node.path && (
        <button
          onClick={() => onToggle(node.path)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs hover:bg-accent/50 rounded transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <Folder className="w-3.5 h-3.5 text-primary/70" />
          <span className="text-muted-foreground font-mono truncate">{node.name}</span>
          <span className="text-muted-foreground/50 text-[10px] ml-auto">
            {countFiles(node)}
          </span>
        </button>
      )}
      {node.isOpen && (
        <>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + (node.path ? 1 : 0)}
              onToggle={onToggle}
              onRemoveFile={onRemoveFile}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />
          ))}
          {node.files.map((file) => (
            <div
              key={file.path}
              onClick={() => onSelectFile(file)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer rounded transition-colors group ${
                selectedFile === file.path ? "bg-primary/10 text-primary" : "hover:bg-accent/50 text-muted-foreground"
              }`}
              style={{ paddingLeft: `${(depth + (node.path ? 1 : 0)) * 16 + 8}px` }}
            >
              <File className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono truncate">{file.name}</span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto mr-1">
                {(file.size / 1024).toFixed(1)}KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFile(file.path); }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function countFiles(node: FolderNode): number {
  return node.files.length + node.children.reduce((acc, c) => acc + countFiles(c), 0);
}

const Analyze = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<{ title: string; code: string; explanation: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // File tree state
  const [fileTree, setFileTree] = useState<FolderNode | null>(null);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  // Rebuild tree when files change
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      setFileTree(buildFileTree(uploadedFiles));
    } else {
      setFileTree(null);
    }
  }, [uploadedFiles]);

  // Combined code from all files
  const combinedCode = useMemo(() => {
    return uploadedFiles
      .map((f) => `// ═══ ${f.path} ═══\n${f.content}`)
      .join("\n\n");
  }, [uploadedFiles]);

  // Use combined code or manual input
  const analysisCode = uploadedFiles.length > 0 ? combinedCode : code;

  const totalSize = useMemo(() => uploadedFiles.reduce((acc, f) => acc + f.size, 0), [uploadedFiles]);

  const shouldIgnore = (path: string) => {
    const parts = path.split("/");
    return parts.some((p) => IGNORED_DIRS.includes(p));
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newFiles: UploadedFile[] = [];
    let skipped = 0;

    for (const file of fileArray) {
      // Get relative path from webkitRelativePath or just name
      const path = (file as any).webkitRelativePath || file.name;

      if (shouldIgnore(path)) { skipped++; continue; }

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) { skipped++; continue; }
      if (file.size > MAX_FILE_SIZE) { skipped++; continue; }
      if (file.size === 0) { skipped++; continue; }

      if (uploadedFiles.length + newFiles.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files reached`);
        break;
      }

      const currentTotal = uploadedFiles.reduce((a, f) => a + f.size, 0) + newFiles.reduce((a, f) => a + f.size, 0);
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        toast.error("Total size limit (2MB) reached");
        break;
      }

      try {
        const content = await file.text();
        newFiles.push({ name: file.name, path, content, size: file.size });
      } catch { /* skip unreadable */ }
    }

    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) loaded${skipped > 0 ? `, ${skipped} skipped` : ""}`);
    } else if (skipped > 0) {
      toast.info(`${skipped} file(s) skipped (unsupported type, too large, or ignored directory)`);
    }
  }, [uploadedFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeFile = useCallback((path: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.path !== path));
    if (selectedFile?.path === path) setSelectedFile(null);
  }, [selectedFile]);

  const clearAll = useCallback(() => {
    setUploadedFiles([]);
    setSelectedFile(null);
    setCode("");
    setResult(null);
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setFileTree((prev) => {
      if (!prev) return prev;
      const toggle = (node: FolderNode): FolderNode => {
        if (node.path === path) return { ...node, isOpen: !node.isOpen };
        return { ...node, children: node.children.map(toggle) };
      };
      return toggle(prev);
    });
  }, []);

  const handleAnalyze = async () => {
    const codeToAnalyze = analysisCode;
    if (!codeToAnalyze.trim()) return;
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
        body: JSON.stringify({ code: codeToAnalyze.slice(0, 100000), explanation_level: "Intermediate", stream: true }),
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
            } catch { /* partial */ }
          }
        }

        if (finalResult) {
          setResult(finalResult);
          if (user) {
            supabase.from("analyses").insert({
              user_id: user.id,
              code: codeToAnalyze.slice(0, 10000),
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
        content: `Context — the user is analyzing this code:\n\`\`\`\n${analysisCode.slice(0, 3000)}\n\`\`\`\n${result ? `Analysis result: ${JSON.stringify({ goal: result.goal, next_steps: result.next_steps, risks: result.risks })}` : ""}\n\nNow answer the user's question:`,
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
          } catch { /* partial */ }
        }
      }
    } catch {
      toast.error("Chat failed. Try again.");
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatMessages, chatLoading, analysisCode, result]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Background3D />
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="text-gradient">Project Analysis</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Upload folders and files to analyze entire projects
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: File Upload & Tree */}
          <div className="lg:col-span-4 space-y-4">
            {/* Upload zones */}
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => folderInputRef.current?.click()}
                className="rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors border-border hover:border-primary/50 hover:bg-primary/5"
              >
                <FolderOpen className="w-6 h-6 mx-auto mb-2 text-primary/70" />
                <p className="text-xs font-medium text-foreground">Upload Folder</p>
                <p className="text-[10px] text-muted-foreground mt-1">Entire project directory</p>
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                  onChange={(e) => e.target.files && processFiles(e.target.files)}
                />
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">Upload Files</p>
                <p className="text-[10px] text-muted-foreground mt-1">Drop or browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  className="hidden"
                  onChange={(e) => e.target.files && processFiles(e.target.files)}
                />
              </div>
            </div>

            {/* Stats bar */}
            {uploadedFiles.length > 0 && (
              <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{uploadedFiles.length}</span> files · <span className="text-foreground font-medium">{(totalSize / 1024).toFixed(0)}KB</span>
                  </span>
                  <button onClick={clearAll} className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Clear all
                  </button>
                </div>
                <Progress value={(totalSize / MAX_TOTAL_SIZE) * 100} className="h-1" />
                <p className="text-[10px] text-muted-foreground">
                  {(totalSize / 1024).toFixed(0)}KB / {(MAX_TOTAL_SIZE / 1024).toFixed(0)}KB
                </p>
              </div>
            )}

            {/* File tree */}
            {fileTree && (
              <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-card/50 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Project Files</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto py-1">
                  <FileTreeNode
                    node={fileTree}
                    depth={0}
                    onToggle={toggleFolder}
                    onRemoveFile={removeFile}
                    selectedFile={selectedFile?.path || null}
                    onSelectFile={setSelectedFile}
                  />
                </div>
              </div>
            )}

            {/* Manual code input (when no files) */}
            {uploadedFiles.length === 0 && (
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
                  rows={16}
                  placeholder="Paste your code here or upload files/folders above..."
                  className="w-full bg-transparent p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
                  spellCheck={false}
                />
              </div>
            )}

            {/* File preview when file selected */}
            {selectedFile && (
              <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                  <FileCode className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground font-mono truncate">{selectedFile.path}</span>
                  <button onClick={() => setSelectedFile(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs text-muted-foreground overflow-auto max-h-[300px]">
                  {selectedFile.content}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="hero" onClick={handleAnalyze} disabled={loading || !analysisCode.trim()} className="flex-1">
                {loading ? <Loader2 className="animate-spin" /> : <Play />}
                {loading ? "Analyzing..." : `Analyze${uploadedFiles.length > 0 ? ` ${uploadedFiles.length} files` : ""}`}
              </Button>
              <Button variant="hero-outline" onClick={() => setChatOpen(!chatOpen)} className="gap-2">
                <MessageSquare className="w-4 h-4" /> Chat
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Supports: .js .ts .py .go .rs .java .cpp .cs .rb .php + more · Auto-ignores node_modules, .git, dist
            </p>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-8">
            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6 min-h-[500px] flex items-start justify-center overflow-y-auto max-h-[calc(100vh-200px)]">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-3 self-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground font-mono">
                      {isStreaming && streamText ? streamText : "AI is analyzing your project..."}
                    </p>
                    <div className="flex gap-1 justify-center">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                      ))}
                    </div>
                  </motion.div>
                ) : result ? (
                  <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full space-y-5 font-mono text-sm">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">{result.language}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent-foreground border border-border">
                        {result.source === "llm-enhanced" ? "✨ AI Enhanced" : "Static Analysis"}
                      </span>
                      {result.code_quality_grade && (
                        <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                          result.code_quality_grade === "A" ? "bg-primary/20 text-primary border-primary/30" :
                          result.code_quality_grade === "B" ? "bg-primary/10 text-primary border-primary/20" :
                          result.code_quality_grade === "C" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                          "bg-destructive/20 text-destructive border-destructive/30"
                        }`}>Grade: {result.code_quality_grade}</span>
                      )}
                      {uploadedFiles.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent-foreground border border-border">
                          {uploadedFiles.length} files analyzed
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">Confidence: {Math.round(result.confidence_score * 100)}%</span>
                    </div>

                    {/* Metrics */}
                    {result.metrics && (
                      <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                        <span>{result.metrics.total_lines} total lines</span><span>•</span>
                        <span>{result.metrics.code_lines} code lines</span><span>•</span>
                        <span>{result.metrics.functions} functions</span><span>•</span>
                        <span>{result.metrics.classes} classes</span><span>•</span>
                        <span>{result.metrics.comment_ratio}% comments</span>
                      </div>
                    )}

                    {/* Highlights */}
                    {result.highlights && result.highlights.length > 0 && (
                      <div>
                        <p className="text-primary text-xs mb-1 flex items-center gap-1">✅ STRENGTHS</p>
                        <ul className="space-y-1">
                          {result.highlights.map((h, i) => (
                            <li key={i} className="text-muted-foreground flex items-start gap-2 text-xs"><span className="text-primary mt-0.5">✓</span> {h}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Goal */}
                    <div>
                      <p className="text-primary text-xs mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> GOAL</p>
                      <p className="text-foreground">{result.goal}</p>
                      {result.current_state && <p className="text-muted-foreground text-xs mt-1">{result.current_state}</p>}
                    </div>

                    {/* Next Steps */}
                    <div>
                      <p className="text-primary text-xs mb-1 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> NEXT STEPS</p>
                      <ul className="space-y-1">
                        {result.next_steps.map((n, i) => (
                          <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="text-foreground flex items-start gap-2">
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
                            <li key={i} className="text-yellow-400/80 flex items-start gap-2"><span className="mt-0.5">⚠</span> {r}</li>
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
                            <li key={i} className="text-foreground flex items-start gap-2"><span className="text-primary mt-0.5">◆</span> {a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Issues */}
                    {result.issues?.length > 0 && (
                      <div>
                        <p className="text-primary text-xs mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> ISSUES ({result.issues.length})</p>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {result.issues.map((issue, i) => (
                            <div key={i} className={`text-xs flex items-start gap-2 px-2 py-1 rounded ${
                              issue.severity === "error" ? "bg-destructive/10 text-destructive" :
                              issue.severity === "warning" ? "bg-yellow-500/10 text-yellow-400" :
                              "bg-muted/50 text-muted-foreground"
                            }`}>
                              <span className="font-mono shrink-0 uppercase text-[10px] mt-0.5">{issue.type}</span>
                              <span>{issue.message}</span>
                              {issue.line && <span className="ml-auto shrink-0 text-muted-foreground">L{issue.line}</span>}
                            </div>
                          ))}
                        </div>
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
                        <motion.div initial={{ width: 0 }} animate={{ width: `${result.completion_percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, hsl(142 71% 45%), hsl(185 70% 50%))` }} />
                      </div>
                      <p className="text-muted-foreground text-xs mt-1">{result.completion_percentage}% complete</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button variant="outline" size="sm" onClick={() => exportAsMarkdown({ ...result, code: analysisCode, created_at: new Date().toISOString() })} className="flex-1 text-xs">
                        <FileText className="w-3 h-3" /> Export .md
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportAsPDF({ ...result, code: analysisCode, created_at: new Date().toISOString() })} className="flex-1 text-xs">
                        <Download className="w-3 h-3" /> Export PDF
                      </Button>
                      <Button variant="hero" size="sm" disabled={suggestionsLoading} onClick={async () => {
                        setSuggestionsLoading(true);
                        setSuggestions([]);
                        try {
                          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                            body: JSON.stringify({ code: analysisCode, analysis: result }),
                          });
                          if (!resp.ok) { toast.error("Failed to get suggestions"); return; }
                          const data = await resp.json();
                          setSuggestions(data.suggestions || []);
                        } catch { toast.error("Failed to generate suggestions"); } finally { setSuggestionsLoading(false); }
                      }} className="flex-1 text-xs">
                        {suggestionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {suggestionsLoading ? "Generating..." : "AI Fixes"}
                      </Button>
                    </div>

                    {/* AI Suggestions */}
                    <AnimatePresence>
                      {suggestions.length > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2">
                          <p className="text-primary text-xs flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI SUGGESTIONS</p>
                          {suggestions.map((s, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-foreground">{s.title}</p>
                                <button onClick={() => { navigator.clipboard.writeText(s.code); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); toast.success("Copied!"); }} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
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
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 self-center">
                    <Brain className="w-12 h-12 text-primary/30 mx-auto" />
                    <div>
                      <p className="text-foreground font-medium mb-1">Ready to analyze</p>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        Upload a project folder or individual files, then hit Analyze for a comprehensive AI-powered code review.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 shrink-0">
              <span className="text-sm font-semibold text-primary flex items-center gap-2"><Bot className="w-4 h-4" /> AI Code Assistant</span>
              <div className="flex items-center gap-1">
                {chatMessages.length > 0 && (
                  <button onClick={() => setChatMessages([])} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary" title="Clear chat"><RotateCcw className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={() => setChatExpanded(!chatExpanded)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary">
                  {chatExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm text-muted-foreground text-center max-w-[200px]">Ask me anything about your code or analysis results</p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} onClick={() => setChatInput(prompt)} className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all">
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
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:bg-card/80 [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-xs [&_code]:text-primary [&_code]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
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
                      {[0, 1, 2].map((i) => (<motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2 shrink-0 bg-card/50">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()} placeholder="Ask about your code..." className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
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

export default Analyze;
