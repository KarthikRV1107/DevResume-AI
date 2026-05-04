import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Demo from "@/components/Demo";
import Footer from "@/components/Footer";
import Background3D from "@/components/Background3D";

const Index = () => (
  <div className="min-h-screen scanline relative">
    <Background3D />
    <Navbar />
    <Hero />
    <Features />
    <Demo />
    <Footer />
  </div>
);

export default Index;
