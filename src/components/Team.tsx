import { motion } from "framer-motion";

const members = [
  { initials: "KR", name: "Karthik R V", role: "ML Engineer" },
  { initials: "CH", name: "Chaitra", role: "Full-Stack Dev" },
  { initials: "TK", name: "Member 3", role: "Design & UX" },
];

const Team = () => (
  <section id="team" className="py-24">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">Built by BWT_Techies</h2>
        <p className="text-muted-foreground">The team behind DevResume AI</p>
      </motion.div>

      <div className="flex flex-wrap justify-center gap-8">
        {members.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card w-48 hover:shadow-md transition-shadow"
          >
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold text-sm">
              {m.initials}
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground text-sm">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.role}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Team;
