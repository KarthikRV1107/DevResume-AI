import { motion } from "framer-motion";
import { Building2, Zap } from "lucide-react";

interface ArchitectureSectionProps {
  architecturalImprovements: string[];
  metrics?: {
    functions: number;
    classes: number;
    imports: number;
  };
}

const ArchitectureSection = ({ architecturalImprovements, metrics }: ArchitectureSectionProps) => {
  const archType = metrics && metrics.classes > 5 ? "Modular" : metrics && metrics.functions > 20 ? "Functional" : "Monolithic";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">Architecture Analysis</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 text-center"
        >
          <p className="text-xs text-muted-foreground font-mono mb-1">Architecture Type</p>
          <p className="text-lg font-bold font-mono text-primary">{archType}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 text-center"
        >
          <p className="text-xs text-muted-foreground font-mono mb-1">Scalability</p>
          <p className={`text-lg font-bold font-mono ${archType === "Monolithic" ? "text-yellow-400" : "text-primary"}`}>
            {archType === "Monolithic" ? "Medium" : "High"}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-4 text-center"
        >
          <p className="text-xs text-muted-foreground font-mono mb-1">Coupling</p>
          <p className={`text-lg font-bold font-mono ${metrics && metrics.imports > 15 ? "text-yellow-400" : "text-primary"}`}>
            {metrics && metrics.imports > 15 ? "Tight" : "Loose"}
          </p>
        </motion.div>
      </div>

      {/* Architecture Diagram Placeholder */}
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-6">
        <p className="text-xs text-primary font-mono mb-4">🏗️ ARCHITECTURE DIAGRAM</p>
        <div className="flex items-center justify-center py-8">
          <div className="grid grid-cols-3 gap-4 text-center text-xs font-mono">
            <div className="col-span-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="text-primary font-bold">Client Layer</p>
              <p className="text-muted-foreground text-[10px]">UI Components, State Management</p>
            </div>
            <div className="rounded-lg border border-border bg-card/80 p-3">
              <p className="text-foreground font-bold">API</p>
              <p className="text-muted-foreground text-[10px]">{metrics?.functions || 0} functions</p>
            </div>
            <div className="rounded-lg border border-border bg-card/80 p-3">
              <p className="text-foreground font-bold">Logic</p>
              <p className="text-muted-foreground text-[10px]">{metrics?.classes || 0} classes</p>
            </div>
            <div className="rounded-lg border border-border bg-card/80 p-3">
              <p className="text-foreground font-bold">Data</p>
              <p className="text-muted-foreground text-[10px]">{metrics?.imports || 0} deps</p>
            </div>
            <div className="col-span-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
              <p className="text-yellow-400 font-bold">Infrastructure</p>
              <p className="text-muted-foreground text-[10px]">Database, Storage, APIs</p>
            </div>
          </div>
        </div>
      </div>

      {architecturalImprovements.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm p-4">
          <p className="text-xs text-primary font-mono mb-2 flex items-center gap-1"><Zap className="w-3 h-3" /> ARCHITECTURE IMPROVEMENTS</p>
          <ul className="space-y-1.5">
            {architecturalImprovements.map((a, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">◆</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ArchitectureSection;
