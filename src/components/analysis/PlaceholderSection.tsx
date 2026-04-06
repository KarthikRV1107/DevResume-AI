import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PlaceholderSectionProps {
  title: string;
  icon: LucideIcon;
  description: string;
  features: string[];
}

const PlaceholderSection = ({ title, icon: Icon, description, features }: PlaceholderSectionProps) => {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground font-mono">{title}</h2>
        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">Coming Soon</span>
      </div>

      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm p-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Icon className="w-12 h-12 text-primary/20 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm mb-4">{description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto">
            {features.map((f, i) => (
              <div key={i} className="text-xs text-muted-foreground/60 font-mono flex items-center gap-2 p-2 rounded-md border border-border/50">
                <span className="text-primary">▸</span> {f}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PlaceholderSection;
