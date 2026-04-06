import { useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileCode, X, Trash2, Play, Loader2, MessageSquare, Github, Archive, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

const MAX_FILE_SIZE = 100 * 1024;
const MAX_FILES = 10;

interface InputSectionProps {
  code: string;
  setCode: (code: string) => void;
  loading: boolean;
  onAnalyze: () => void;
  onChatToggle: () => void;
}

const InputSection = ({ code, setCode, loading, onAnalyze, onChatToggle }: InputSectionProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [inputMode, setInputMode] = useState<"paste" | "upload" | "github" | "url">("paste");
  const [githubUrl, setGithubUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const combined = all.map((f) => `// ═══ ${f.name} ═══\n${f.content}`).join("\n\n");
      setCode(combined);
      toast.success(`${newFiles.length} file(s) loaded`);
    }
  }, [uploadedFiles, setCode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeFile = useCallback((index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    if (updated.length === 0) setCode("");
    else setCode(updated.map((f) => `// ═══ ${f.name} ═══\n${f.content}`).join("\n\n"));
  }, [uploadedFiles, setCode]);

  const clearAllFiles = useCallback(() => { setUploadedFiles([]); setCode(""); }, [setCode]);

  return (
    <div className="h-full flex flex-col">
      {/* Input Mode Tabs */}
      <div className="flex gap-1 p-3 border-b border-border bg-card/30">
        {[
          { id: "paste" as const, icon: FileCode, label: "Paste Code" },
          { id: "upload" as const, icon: Upload, label: "Upload Files" },
          { id: "github" as const, icon: Github, label: "GitHub Repo" },
          { id: "url" as const, icon: Globe, label: "API Endpoint" },
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setInputMode(mode.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
              inputMode === mode.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <mode.icon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{mode.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        {inputMode === "github" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-mono text-primary">
                <Github className="w-4 h-4" /> GitHub Repository
              </div>
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full bg-secondary/50 text-sm font-mono text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50"
              />
              <Button
                variant="hero"
                size="sm"
                className="w-full"
                onClick={() => toast.info("GitHub integration coming soon! Paste your code directly for now.")}
              >
                <Github className="w-4 h-4" /> Clone & Analyze
              </Button>
              <p className="text-[10px] text-muted-foreground/60">
                Supports public repositories. Private repos require GitHub authentication.
              </p>
            </div>
          </div>
        )}

        {inputMode === "url" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-mono text-primary">
                <Globe className="w-4 h-4" /> API Endpoint Analysis
              </div>
              <input
                placeholder="https://api.example.com/v1"
                className="w-full bg-secondary/50 text-sm font-mono text-foreground placeholder:text-muted-foreground px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary/50"
              />
              <Button
                variant="hero"
                size="sm"
                className="w-full"
                onClick={() => toast.info("API endpoint analysis coming soon!")}
              >
                <Globe className="w-4 h-4" /> Analyze Endpoint
              </Button>
            </div>
          </div>
        )}

        {inputMode === "upload" && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop files here or <span className="text-primary">browse</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Supports 30+ languages · Max 100KB each · Up to 10 files
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
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <Archive className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground/60">
                ZIP file upload coming soon — analyze entire projects at once
              </p>
            </div>
          </>
        )}

        {(inputMode === "paste" || inputMode === "upload") && (
          <>
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                    <FileCode className="w-3 h-3" />
                    {f.name}
                    <button onClick={() => removeFile(i)} className="hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button onClick={clearAllFiles} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden flex-1 flex flex-col">
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
                placeholder="Paste your code here... Supports projects of any size."
                className="w-full flex-1 bg-transparent p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed min-h-[300px]"
                spellCheck={false}
              />
            </div>
          </>
        )}

        <div className="flex gap-3 shrink-0">
          <Button variant="hero" onClick={onAnalyze} disabled={loading || !code.trim()} className="flex-1">
            {loading ? <Loader2 className="animate-spin" /> : <Play />}
            {loading ? "Analyzing..." : "Deep Analyze"}
          </Button>
          <Button variant="hero-outline" onClick={onChatToggle} className="gap-2">
            <MessageSquare className="w-4 h-4" /> Chat
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InputSection;
