import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Code2, Shield, Zap, Building2, Package,
  TestTube2, Brain, TrendingDown, BarChart3, Upload
} from "lucide-react";

export type AnalysisSection =
  | "input"
  | "overview"
  | "code"
  | "performance"
  | "security"
  | "architecture"
  | "dependencies"
  | "testing"
  | "ai-insights"
  | "risks"
  | "dashboard";

interface SidebarItem {
  id: AnalysisSection;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "input", label: "Input", icon: Upload },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "code", label: "Code Quality", icon: Code2 },
  { id: "security", label: "Security", icon: Shield, badge: "!" },
  { id: "performance", label: "Performance", icon: Zap },
  { id: "architecture", label: "Architecture", icon: Building2 },
  { id: "dependencies", label: "Dependencies", icon: Package },
  { id: "testing", label: "Testing", icon: TestTube2 },
  { id: "ai-insights", label: "AI Insights", icon: Brain },
  { id: "risks", label: "Risk Analysis", icon: TrendingDown },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
];

interface AnalysisSidebarProps {
  activeSection: AnalysisSection;
  onSectionChange: (section: AnalysisSection) => void;
  hasResult: boolean;
}

const AnalysisSidebar = ({ activeSection, onSectionChange, hasResult }: AnalysisSidebarProps) => {
  return (
    <aside className="w-16 md:w-56 shrink-0 border-r border-border bg-card/50 backdrop-blur-sm flex flex-col">
      <div className="p-3 md:p-4 border-b border-border">
        <h2 className="hidden md:block text-sm font-bold text-primary font-mono tracking-wider">
          PROJECT ANALYZER
        </h2>
        <div className="md:hidden flex justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {SIDEBAR_ITEMS.map((item) => {
          const disabled = item.id !== "input" && !hasResult;
          return (
            <button
              key={item.id}
              onClick={() => !disabled && onSectionChange(item.id)}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 font-mono",
                activeSection === item.id
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_10px_-3px_hsl(142_71%_45%/0.3)]"
                  : disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline truncate">{item.label}</span>
              {item.badge && hasResult && (
                <span className="hidden md:inline ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default AnalysisSidebar;
