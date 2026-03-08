import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Menu, X, History, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { label: "Features", href: "#features" },
  { label: "Demo", href: "#demo" },
  { label: "Pricing", href: "#pricing" },
  { label: "Team", href: "#team" },
  { label: "Pitch", href: "#pitch" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <a href="/" className="flex items-center gap-2 text-primary font-bold text-lg">
          <Terminal className="w-5 h-5" />
          <span><span className="text-foreground">DevResume</span> AI</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {l.label}
            </a>
          ))}
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <History className="w-4 h-4" />
                History
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button className="text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-b border-border bg-background/95 backdrop-blur-md"
          >
            <div className="flex flex-col gap-4 p-4">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {l.label}
                </a>
              ))}
              {user ? (
                <>
                  <button onClick={() => { setOpen(false); navigate("/history"); }} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-2">
                    <History className="w-4 h-4" /> History
                  </button>
                  <button onClick={() => { setOpen(false); signOut(); }} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <Button variant="hero" size="sm" className="w-fit" onClick={() => { setOpen(false); navigate("/auth"); }}>
                  Sign In
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
