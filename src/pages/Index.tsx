import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Demo from "@/components/Demo";
import Team from "@/components/Team";
import Pitch from "@/components/Pitch";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
import Background3D from "@/components/Background3D";

const Index = () => (
  <div className="min-h-screen scanline relative">
    <Background3D />
    <Navbar />
    <Hero />
    <Features />
    <Demo />
    <Pricing />
    <Team />
    <Pitch />
    <Footer />
  </div>
);

export default Index;
