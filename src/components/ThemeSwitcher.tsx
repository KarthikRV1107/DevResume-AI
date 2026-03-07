import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Palette } from "lucide-react";

const themes = [
  { id: "green", label: "Matrix", color: "hsl(142 71% 45%)" },
  { id: "blue", label: "Cyber", color: "hsl(210 100% 55%)" },
  { id: "purple", label: "Neon", color: "hsl(270 80% 60%)" },
  { id: "orange", label: "Ember", color: "hsl(25 95% 55%)" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

const ThemeSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ThemeId>(() => {
    return (localStorage.getItem("devresume-theme") as ThemeId) || "green";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", active);
    localStorage.setItem("devresume-theme", active);
  }, [active]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center text-primary shadow-lg backdrop-blur-sm hover:border-primary/50 transition-colors"
        aria-label="Change theme"
      >
        <Palette className="w-5 h-5" />
      </motion.button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          className="flex flex-col gap-2 p-2 rounded-lg bg-card border border-border shadow-xl backdrop-blur-sm"
        >
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); setOpen(false); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                active === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-border"
                style={{ backgroundColor: t.color }}
              />
              {t.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
