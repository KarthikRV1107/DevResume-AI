import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Demo from "@/components/Demo";
import Footer from "@/components/Footer";
import Background3D from "@/components/Background3D";
import Seo from "@/components/Seo";

const Index = () => (
  <div className="min-h-screen scanline relative">
    <Seo
      title="DevResume — AI Context Recovery for Developers"
      description="DevResume analyzes your codebase to recover lost context, score quality, and generate AI-powered suggestions so developers can resume work fast."
      path="/"
    />
    <Background3D />
    <Navbar />
    <Hero />
    <Features />
    <Demo />
    <Footer />
  </div>
);

export default Index;
