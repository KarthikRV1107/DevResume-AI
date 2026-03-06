import { Terminal, Github, ExternalLink } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border py-10">
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-mono"><span className="text-foreground">DevResume</span> AI</span>
          <span className="text-border">|</span>
          <span>Built by BWT_Techies</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#demo" className="hover:text-primary transition-colors">Demo</a>
          <a href="#team" className="hover:text-primary transition-colors">Team</a>
          <a href="#pitch" className="hover:text-primary transition-colors">Pitch</a>
        </div>
      </div>
      <div className="mt-6 text-center text-xs text-muted-foreground/60 font-mono">
        © 2026 BWT_Techies. Context Recovery Engine v1.0
      </div>
    </div>
  </footer>
);

export default Footer;
