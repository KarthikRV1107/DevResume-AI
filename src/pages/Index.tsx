import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Demo from "@/components/Demo";
import Team from "@/components/Team";
import Pitch from "@/components/Pitch";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background scanline">
    <Navbar />
    <Hero />
    <Features />
    <Demo />
    <Team />
    <Pitch />
    <Footer />
  </div>
);

export default Index;
