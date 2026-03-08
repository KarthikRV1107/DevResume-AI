import { motion } from "framer-motion";
import { Check, Zap, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Try DevResume AI with basic analysis.",
    icon: Zap,
    features: [
      "5 analyses per day",
      "Single file analysis",
      "Basic context recovery",
      "Community support",
    ],
    cta: "Get Started",
    variant: "hero-outline" as const,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "For developers who ship regularly.",
    icon: Crown,
    features: [
      "Unlimited analyses",
      "Multi-file analysis",
      "AI chat follow-ups",
      "Export reports (PDF/MD)",
      "Analysis history",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    variant: "hero" as const,
    highlight: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/user/month",
    desc: "For teams recovering shared context.",
    icon: Building2,
    features: [
      "Everything in Pro",
      "Team workspace",
      "Shared analysis history",
      "Admin dashboard",
      "SSO & SAML",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    variant: "hero-outline" as const,
    highlight: false,
  },
];

const Pricing = () => (
  <section id="pricing" className="py-24">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">Simple Pricing</span>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Start free. Upgrade when you need more power.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`relative rounded-lg border bg-card/60 backdrop-blur-sm p-6 flex flex-col transition-all duration-300 ${
              plan.highlight
                ? "border-primary glow-border"
                : "border-border glow-border-hover hover:border-primary/40"
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-mono font-semibold">
                Most Popular
              </div>
            )}

            <div className="mb-6">
              <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <plan.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">{plan.price}</span>
              <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={plan.variant}
              className="w-full"
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            >
              {plan.cta}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Pricing;
