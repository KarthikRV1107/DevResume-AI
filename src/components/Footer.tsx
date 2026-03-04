import { Terminal } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border py-8">
    <div className="container mx-auto px-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Terminal className="w-4 h-4 text-primary" />
      <span>DevResume AI — Built by BWT_Techies</span>
    </div>
  </footer>
);

export default Footer;
