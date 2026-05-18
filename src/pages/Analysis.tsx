import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, Zap, AlertTriangle, Brain, ChevronRight, MessageSquare, Send, X, Upload, FileCode, Trash2, Download, FileText, Sparkles, Copy, Check, Bot, User, RotateCcw, Maximize2, Minimize2, Shield, ShieldAlert, ShieldCheck, ShieldX, Package, Scale, FolderOpen, ChevronDown, ChevronUp, Folder, File, Eye } from "lucide-react";
import { exportAsMarkdown, exportAsPDF } from "@/lib/exportAnalysis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/Navbar";
import Background3D from "@/components/Background3D";
import Seo from "@/components/Seo";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SecurityFinding {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  file?: string;
  line?: number;
  owasp?: string;
  cwe?: string;
  remediation: string;
}

interface DependencyFinding {
  package: string;
  version: string;
  severity: "critical" | "high" | "medium" | "low";
  issue: string;
  recommendation: string;
}

interface ComplianceCheck {
  framework: string;
  control: string;
  status: "pass" | "fail" | "warning" | "not_applicable";
  description: string;
  remediation?: string;
}

interface VirusTotalResult {
  url: string;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  status: "clean" | "suspicious" | "malicious" | "error";
  permalink?: string;
  error?: string;
}

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
  security_issues?: SecurityFinding[];
  dependency_audit?: DependencyFinding[];
  compliance_checks?: ComplianceCheck[];
  security_summary?: { critical: number; high: number; medium: number; low: number; total: number };
  virustotal_results?: VirusTotalResult[];
}

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface UploadedFile {
  name: string;
  content: string;
  path?: string;
}

const ALLOWED_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".cpp", ".c",
  ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt", ".scala", ".sh",
  ".bash", ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
  ".toml", ".xml", ".md", ".txt", ".env", ".vue", ".svelte",
  ".lock", ".config", ".cfg", ".ini", ".dockerfile", ".gitignore",
  ".editorconfig", ".eslintrc", ".prettierrc", ".babelrc",
];

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

const QUICK_PROMPTS = [
  "What's the biggest risk in this code?",
  "How can I improve performance?",
  "Suggest a better architecture",
  "What are the security vulnerabilities?",
];

const severityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const complianceStatusIcon = (status: string) => {
  switch (status) {
    case "pass": return <ShieldCheck className="w-3.5 h-3.5 text-green-400" />;
    case "fail": return <ShieldX className="w-3.5 h-3.5 text-red-400" />;
    case "warning": return <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />;
    default: return <Shield className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

// ─── File Tree Types ──────────────────────────────────────────────────
interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
  fileIndex?: number;
}

function buildFileTree(files: UploadedFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const parts = (file.path || file.name).split("/").filter(Boolean);
    let current = root;
    
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      const isFile = j === parts.length - 1;
      const existing = current.find(n => n.name === part && n.type === (isFile ? "file" : "folder"));
      
      if (existing) {
        if (!isFile && existing.children) {
          current = existing.children;
        }
      } else {
        const node: TreeNode = {
          name: part,
          path: parts.slice(0, j + 1).join("/"),
          type: isFile ? "file" : "folder",
          ...(isFile ? { fileIndex: i } : { children: [] }),
        };
        current.push(node);
        if (!isFile && node.children) {
          current = node.children;
        }
      }
    }
  }
  
  // Sort: folders first, then files, alphabetically
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(n => { if (n.children) sortTree(n.children); });
  };
  sortTree(root);
  return root;
}

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colors: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-blue-400", js: "text-yellow-400", jsx: "text-yellow-400",
    py: "text-green-400", go: "text-cyan-400", rs: "text-orange-400", java: "text-red-400",
    json: "text-yellow-300", yaml: "text-pink-400", yml: "text-pink-400", md: "text-muted-foreground",
    css: "text-purple-400", scss: "text-purple-400", html: "text-orange-300",
    sql: "text-blue-300", sh: "text-green-300", env: "text-yellow-200",
  };
  return colors[ext] || "text-muted-foreground";
};

function FileTreeNode({ node, selectedFile, onSelectFile, expandedFolders, onToggleFolder, depth = 0 }: {
  node: TreeNode;
  selectedFile: number | null;
  onSelectFile: (index: number) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  depth?: number;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = node.type === "file" && node.fileIndex === selectedFile;

  return (
    <div>
      <button
        onClick={() => {
          if (node.type === "folder") onToggleFolder(node.path);
          else if (node.fileIndex !== undefined) onSelectFile(node.fileIndex);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono hover:bg-primary/10 transition-colors rounded-sm ${
          isSelected ? "bg-primary/20 text-primary" : "text-foreground/80"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === "folder" ? (
          <>
            <ChevronRight className={`w-3 h-3 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
            <Folder className={`w-3.5 h-3.5 shrink-0 ${isExpanded ? "text-primary" : "text-muted-foreground"}`} />
          </>
        ) : (
          <>
            <span className="w-3" />
            <File className={`w-3.5 h-3.5 shrink-0 ${getFileIcon(node.name)}`} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const Analysis = () => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // File tree state
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showAllFiles, setShowAllFiles] = useState(false); // false = viewing single file, true = all combined

  const [suggestions, setSuggestions] = useState<{ title: string; code: string; explanation: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeResultTab, setActiveResultTab] = useState<"overview" | "security" | "dependencies" | "compliance">("overview");

  const fileTree = useMemo(() => buildFileTree(uploadedFiles), [uploadedFiles]);

  const editorContent = useMemo(() => {
    if (uploadedFiles.length === 0) return code;
    if (selectedFileIndex !== null && !showAllFiles) {
      return uploadedFiles[selectedFileIndex]?.content || "";
    }
    return uploadedFiles.map((f) => `// ═══ ${f.path || f.name} ═══\n${f.content}`).join("\n\n");
  }, [code, uploadedFiles, selectedFileIndex, showAllFiles]);

  const combinedCode = useMemo(() => {
    if (uploadedFiles.length === 0) return code;
    return uploadedFiles.map((f) => `// ═══ ${f.path || f.name} ═══\n${f.content}`).join("\n\n");
  }, [code, uploadedFiles]);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAllFolders = useCallback(() => {
    const allPaths = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.type === "folder") {
          allPaths.add(n.path);
          if (n.children) collect(n.children);
        }
      });
    };
    collect(fileTree);
    setExpandedFolders(allPaths);
  }, [fileTree]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setIsProcessingFiles(true);
    setUploadProgress(0);

    let totalSize = uploadedFiles.reduce((s, f) => s + f.content.length, 0);
    const totalAfter = uploadedFiles.length + fileArray.length;
    
    if (totalAfter > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed. Got ${totalAfter}.`);
      setIsProcessingFiles(false);
      return;
    }

    const newFiles: UploadedFile[] = [];
    let processed = 0;
    let skipped = 0;

    for (const file of fileArray) {
      processed++;
      setUploadProgress(Math.round((processed / fileArray.length) * 100));

      const path = (file as any).webkitRelativePath || file.name;
      if (/node_modules|\.git\/|dist\/|build\/|\.next\/|__pycache__|\.pyc$|\.class$|\.exe$|\.dll$|\.so$|\.o$|\.a$|\.jar$|\.war$|\.zip$|\.tar|\.gz$|\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.ico$|\.woff|\.ttf|\.eot$|\.mp4$|\.mp3$|\.mov$|\.avi$|\.pdf$|\.DS_Store|Thumbs\.db/i.test(path)) {
        skipped++;
        continue;
      }

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext) && !file.name.includes(".")) {
        skipped++;
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        skipped++;
        continue;
      }

      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        toast.warning(`Reached ${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)}MB limit. Some files skipped.`);
        break;
      }

      try {
        const content = await file.text();
        totalSize += content.length;
        newFiles.push({ name: file.name, content, path });

        if (!projectName && path.includes("/")) {
          setProjectName(path.split("/")[0]);
        }
      } catch {
        skipped++;
      }
    }

    if (newFiles.length > 0) {
      const all = [...uploadedFiles, ...newFiles];
      setUploadedFiles(all);
      const combined = all.map((f) => `// ═══ ${f.path || f.name} ═══\n${f.content}`).join("\n\n");
      setCode(combined);
      setSelectedFileIndex(0);
      setShowAllFiles(false);
      // Auto-expand first-level folders
      const firstLevelFolders = new Set<string>();
      all.forEach(f => {
        const parts = (f.path || f.name).split("/");
        if (parts.length > 1) firstLevelFolders.add(parts[0]);
      });
      setExpandedFolders(firstLevelFolders);
      toast.success(`${newFiles.length} file(s) loaded${skipped > 0 ? ` (${skipped} skipped)` : ""}`);
    } else if (skipped > 0) {
      toast.warning(`All ${skipped} files were skipped (unsupported types or too large)`);
    }

    setIsProcessingFiles(false);
    setUploadProgress(0);
  }, [uploadedFiles, projectName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    if (items) {
      const allFiles: File[] = [];
      const traverseDir = async (entry: any): Promise<void> => {
        if (entry.isFile) {
          return new Promise((resolve) => {
            entry.file((file: File) => { allFiles.push(file); resolve(); });
          });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          return new Promise((resolve) => {
            reader.readEntries(async (entries: any[]) => {
              for (const e of entries) await traverseDir(e);
              resolve();
            });
          });
        }
      };

      const entries = Array.from(items).map((item: any) => item.webkitGetAsEntry?.()).filter(Boolean);
      if (entries.length > 0) {
        Promise.all(entries.map(traverseDir)).then(() => {
          if (allFiles.length > 0) processFiles(allFiles);
        });
        return;
      }
    }
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragOver(false); }, []);

  const removeFile = useCallback((index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    if (updated.length === 0) { setCode(""); setProjectName(""); setSelectedFileIndex(null); } else {
      setCode(updated.map((f) => `// ═══ ${f.path || f.name} ═══\n${f.content}`).join("\n\n"));
      if (selectedFileIndex !== null && selectedFileIndex >= updated.length) setSelectedFileIndex(updated.length - 1);
    }
  }, [uploadedFiles, selectedFileIndex]);

  const clearAllFiles = useCallback(() => { setUploadedFiles([]); setCode(""); setProjectName(""); setSelectedFileIndex(null); setExpandedFolders(new Set()); }, []);

  const handleAnalyze = async () => {
    const analyzeCode = combinedCode.trim() || code.trim();
    if (!analyzeCode) return;
    if (!user) { toast.error("Please sign in to analyze code."); return; }
    setLoading(true);
    setResult(null);
    setStreamText("");
    setIsStreaming(true);
    setActiveResultTab("overview");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          code: analyzeCode,
          explanation_level: "Intermediate",
          stream: true,
          project_name: projectName || undefined,
          total_files: uploadedFiles.length || undefined,
        }),
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
            supabase.from("analyses").insert({
              user_id: user.id,
              code: analyzeCode.slice(0, 50000),
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
              security_issues: (finalResult.security_issues || []) as any,
              dependency_audit: (finalResult.dependency_audit || []) as any,
              compliance_checks: (finalResult.compliance_checks || []) as any,
              project_name: projectName || null,
              total_files: uploadedFiles.length || 0,
              total_size_bytes: analyzeCode.length,
            } as any).then(({ error }) => {
              if (!error) toast.success("Analysis saved to history!");
            });
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
        content: `Context — the user is analyzing this code:\n\`\`\`\n${combinedCode.slice(0, 3000)}\n\`\`\`\n${result ? `Analysis result: ${JSON.stringify({ goal: result.goal, next_steps: result.next_steps, risks: result.risks, security_issues: result.security_issues?.slice(0, 5) })}` : ""}\n\nNow answer the user's question:`,
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
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Chat failed. Try again.");
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatMessages, chatLoading, combinedCode, result]);

  const securitySummary = result?.security_summary;
  const securityScore = securitySummary
    ? Math.max(0, 100 - (securitySummary.critical * 25) - (securitySummary.high * 15) - (securitySummary.medium * 5) - (securitySummary.low * 1))
    : null;

  const selectedFileName = selectedFileIndex !== null ? (uploadedFiles[selectedFileIndex]?.path || uploadedFiles[selectedFileIndex]?.name || "editor") : "editor";

  return (
    <div className="min-h-screen scanline relative">
      <Seo
        title="Code Analysis — DevResume"
        description="Upload code or a project folder and get instant static analysis, security findings, and AI-powered suggestions from DevResume."
        path="/analysis"
      />
      <Background3D />
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">Enterprise Analysis</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
              Upload entire project folders — get deep code quality, security (OWASP Top 10), dependency audit, and compliance analysis.
            </p>
          </motion.div>

          {/* Upload zone (always visible at top) */}
          <div className="max-w-[90rem] mx-auto px-4 mb-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop <span className="text-primary font-semibold">files or folders</span> here
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="text-xs">
                    <FileCode className="w-3.5 h-3.5 mr-1" /> Files
                  </Button>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }} className="text-xs">
                    <FolderOpen className="w-3.5 h-3.5 mr-1" /> Folder
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  {MAX_FILES} files · {Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB/file · {Math.round(MAX_TOTAL_SIZE / 1024 / 1024)}MB total
                </p>
              </div>
              <input ref={fileInputRef} type="file" multiple accept={ALLOWED_EXTENSIONS.join(",")} className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />
              <input ref={folderInputRef} type="file" multiple {...{ webkitdirectory: "", directory: "" } as any} className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />
            </div>

            {isProcessingFiles && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Processing files... {uploadProgress}%
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name (auto-detected)"
                  className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-1.5 rounded border border-border focus:outline-none focus:border-primary/50"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {uploadedFiles.length} files · {(combinedCode.length / 1024).toFixed(0)}KB
                </span>
                <button onClick={clearAllFiles} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-[90rem] mx-auto px-4">
            {/* Input: File Tree + Editor */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
                {/* Editor header */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                  <span className="w-3 h-3 rounded-full bg-destructive/70" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <span className="w-3 h-3 rounded-full bg-primary/70" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono truncate flex-1">
                    {showAllFiles ? `All Files (${uploadedFiles.length})` : selectedFileName}
                  </span>
                  {uploadedFiles.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setShowAllFiles(false); if (selectedFileIndex === null) setSelectedFileIndex(0); }}
                        className={`text-[10px] px-2 py-0.5 rounded transition-colors ${!showAllFiles ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Single
                      </button>
                      <button
                        onClick={() => setShowAllFiles(true)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-colors ${showAllFiles ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        All
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex" style={{ minHeight: "500px" }}>
                  {/* File tree sidebar */}
                  {uploadedFiles.length > 0 && (
                    <div className="w-48 md:w-56 border-r border-border bg-card/30 flex flex-col shrink-0">
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Explorer</span>
                        <button onClick={expandAllFolders} className="text-[10px] text-muted-foreground hover:text-primary transition-colors" title="Expand all" aria-label="Expand all folders">
                          <FolderOpen className="w-3 h-3" />
                        </button>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="py-1">
                          {fileTree.map((node) => (
                            <FileTreeNode
                              key={node.path}
                              node={node}
                              selectedFile={selectedFileIndex}
                              onSelectFile={(i) => { setSelectedFileIndex(i); setShowAllFiles(false); }}
                              expandedFolders={expandedFolders}
                              onToggleFolder={toggleFolder}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Code editor */}
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={editorContent}
                      onChange={(e) => {
                        if (uploadedFiles.length > 0 && selectedFileIndex !== null && !showAllFiles) {
                          const updated = [...uploadedFiles];
                          updated[selectedFileIndex] = { ...updated[selectedFileIndex], content: e.target.value };
                          setUploadedFiles(updated);
                          setCode(updated.map((f) => `// ═══ ${f.path || f.name} ═══\n${f.content}`).join("\n\n"));
                        } else {
                          setCode(e.target.value);
                        }
                      }}
                      placeholder="Paste your code here, upload files, or drop an entire project folder above..."
                      className="w-full h-full bg-transparent p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
                      style={{ minHeight: "500px" }}
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="hero" onClick={handleAnalyze} disabled={loading || (!code.trim() && !combinedCode.trim())} className="flex-1">
                  {loading ? <Loader2 className="animate-spin" /> : <Play />}
                  {loading ? "Analyzing..." : "Analyze Project"}
                </Button>
                <Button variant="hero-outline" onClick={() => setChatOpen(!chatOpen)} className="gap-2">
                  <MessageSquare className="w-4 h-4" /> Chat
                </Button>
              </div>
            </motion.div>

            {/* Output */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6 md:p-8 min-h-[500px] flex flex-col overflow-y-auto max-h-[1200px]"
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-3 m-auto">
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
                  <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full space-y-4 font-mono text-sm flex-1">
                    {/* Top badges */}
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
                      {securityScore !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                          securityScore >= 80 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                          securityScore >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                          "bg-red-500/20 text-red-400 border-red-500/30"
                        }`}>
                          <Shield className="w-3 h-3 inline mr-1" />Security: {securityScore}/100
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">Confidence: {Math.round(result.confidence_score * 100)}%</span>
                    </div>

                    {/* Tab navigation */}
                    <div className="flex gap-1 border-b border-border pb-1">
                      {(["overview", "security", "dependencies", "compliance"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveResultTab(tab)}
                          className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-t transition-colors ${
                            activeResultTab === tab
                              ? "bg-primary/20 text-primary border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab === "security" && securitySummary && securitySummary.total > 0 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[9px] mr-1">{securitySummary.total}</span>
                          )}
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Overview Tab */}
                    {activeResultTab === "overview" && (
                      <div className="space-y-4">
                        {result.metrics && (
                          <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                            <span>{result.metrics.code_lines} code lines</span><span>•</span>
                            <span>{result.metrics.functions} functions</span><span>•</span>
                            <span>{result.metrics.classes} classes</span><span>•</span>
                            <span>{result.metrics.comment_ratio}% comments</span>
                            {uploadedFiles.length > 0 && <><span>•</span><span>{uploadedFiles.length} files</span></>}
                          </div>
                        )}

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

                        <div>
                          <p className="text-primary text-xs mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> GOAL</p>
                          <p className="text-foreground">{result.goal}</p>
                          {result.current_state && <p className="text-muted-foreground text-xs mt-1">{result.current_state}</p>}
                        </div>

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

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-primary text-xs">MOMENTUM</p>
                            <p className="text-xs text-muted-foreground">
                              Effort: <span className={result.effort_level === "High" ? "text-destructive" : result.effort_level === "Medium" ? "text-yellow-400" : "text-primary"}>{result.effort_level}</span>
                            </p>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${result.completion_percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, hsl(142 71% 45%), hsl(185 70% 50%))` }} />
                          </div>
                          <p className="text-muted-foreground text-xs mt-1">{result.completion_percentage}% complete</p>
                        </div>
                      </div>
                    )}

                    {/* Security Tab */}
                    {activeResultTab === "security" && (
                      <div className="space-y-4">
                        {securitySummary && (
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: "Critical", count: securitySummary.critical, color: "text-red-400 bg-red-500/10 border-red-500/20" },
                              { label: "High", count: securitySummary.high, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
                              { label: "Medium", count: securitySummary.medium, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
                              { label: "Low", count: securitySummary.low, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                            ].map((s) => (
                              <div key={s.label} className={`text-center rounded-lg border p-2 ${s.color}`}>
                                <p className="text-lg font-bold">{s.count}</p>
                                <p className="text-[10px] uppercase">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {result.security_issues && result.security_issues.length > 0 ? (
                          <div className="space-y-2">
                            {result.security_issues.map((finding, i) => (
                              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-background/50 p-3 space-y-1.5">
                                <div className="flex items-start gap-2">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${severityColor(finding.severity)}`}>{finding.severity}</span>
                                  <div className="flex-1">
                                    <p className="text-xs font-semibold text-foreground">{finding.title}</p>
                                    <p className="text-[11px] text-muted-foreground">{finding.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground/70">{finding.category}</span>
                                  {finding.owasp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{finding.owasp}</span>}
                                  {finding.cwe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{finding.cwe}</span>}
                                </div>
                                <p className="text-[11px] text-primary/80">💡 {finding.remediation}</p>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No security vulnerabilities detected!</p>
                          </div>
                        )}

                        {/* VirusTotal URL Scan Results */}
                        {result.virustotal_results && result.virustotal_results.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-primary" />
                              VirusTotal URL Scan ({result.virustotal_results.length} URL{result.virustotal_results.length > 1 ? "s" : ""})
                            </h4>
                            {result.virustotal_results.map((vt, i) => (
                              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-background/50 p-3 space-y-1.5">
                                <div className="flex items-start gap-2">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${
                                    vt.status === "malicious" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                                    vt.status === "suspicious" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
                                    vt.status === "error" ? "text-muted-foreground bg-secondary border-border" :
                                    "text-green-400 bg-green-500/10 border-green-500/20"
                                  }`}>{vt.status}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-mono text-foreground truncate">{vt.url}</p>
                                    {vt.error ? (
                                      <p className="text-[11px] text-muted-foreground">{vt.error}</p>
                                    ) : (
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] text-red-400">🔴 {vt.malicious} malicious</span>
                                        <span className="text-[10px] text-yellow-400">⚠️ {vt.suspicious} suspicious</span>
                                        <span className="text-[10px] text-green-400">✅ {vt.harmless} clean</span>
                                        <span className="text-[10px] text-muted-foreground">❓ {vt.undetected}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dependencies Tab */}
                    {activeResultTab === "dependencies" && (
                      <div className="space-y-3">
                        {result.dependency_audit && result.dependency_audit.length > 0 ? (
                          result.dependency_audit.map((dep, i) => (
                            <div key={i} className="rounded-lg border border-border bg-background/50 p-3 space-y-1">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-foreground">{dep.package}</span>
                                <span className="text-[10px] text-muted-foreground">v{dep.version}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ml-auto ${severityColor(dep.severity)}`}>{dep.severity}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{dep.issue}</p>
                              <p className="text-[11px] text-primary/80">💡 {dep.recommendation}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No dependency issues found. Include package.json for audit.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compliance Tab */}
                    {activeResultTab === "compliance" && (
                      <div className="space-y-3">
                        {result.compliance_checks && result.compliance_checks.length > 0 ? (
                          <>
                            {["SOC2", "GDPR"].map((fw) => {
                              const fwChecks = result.compliance_checks!.filter(c => c.framework === fw);
                              if (fwChecks.length === 0) return null;
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
                                        {complianceStatusIcon(check.status)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-medium text-foreground">{check.control}</p>
                                          <p className="text-[10px] text-muted-foreground">{check.description}</p>
                                          {check.remediation && <p className="text-[10px] text-primary/70 mt-0.5">💡 {check.remediation}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <Scale className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No compliance data available.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Export + AI Fixes */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button variant="outline" size="sm" onClick={() => exportAsMarkdown({ ...result, code: combinedCode, created_at: new Date().toISOString() })} className="flex-1 text-xs">
                        <FileText className="w-3 h-3" /> Export .md
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportAsPDF({ ...result, code: combinedCode, created_at: new Date().toISOString() })} className="flex-1 text-xs">
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
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                              body: JSON.stringify({ code: combinedCode, analysis: result }),
                            });
                            if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Failed" })); toast.error(err.error || "Failed"); return; }
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
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3 m-auto">
                    <Brain className="w-10 h-10 text-primary/30 mx-auto" />
                    <p className="text-muted-foreground text-sm font-mono">Upload a project folder or paste code, then hit Analyze.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
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
                  <button onClick={() => setChatMessages([])} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary" title="Clear chat">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setChatExpanded(!chatExpanded)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary" title={chatExpanded ? "Minimize" : "Expand"}>
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
                className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
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
