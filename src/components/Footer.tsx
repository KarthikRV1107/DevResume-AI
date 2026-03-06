import { Terminal } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border py-8">
    <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Terminal className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">DevResume</span>
        <span className="text-muted-foreground">AI</span>
      </div>
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
        <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
        <a href="#team" className="hover:text-foreground transition-colors">Team</a>
      </div>
      <p className="text-xs text-muted-foreground">© 2026 BWT_Techies. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
