import { motion } from "framer-motion";

const members = [
  { initials: "KR", name: "Karthik R V", role: "ML Engineer" },
  { initials: "CH", name: "Chaitra", role: "Full-Stack Dev" },
  { initials: "AI", name: "Aishwarya", role: "Product & UX" },
  { initials: "KE", name: "Keerthana", role: "Product & UX" },
];

const Team = () => (
  <section id="team" className="py-24">
    <div className="container mx-auto px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Built by <span className="text-gradient">BWT_Techies</span>
        </h2>
        <p className="text-muted-foreground">The team behind DevResume AI.</p>
      </motion.div>

      <div className="flex flex-wrap justify-center gap-8 md:gap-12">
        {members.map((m, i) => (
          <motion.div
            key={m.initials}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, type: "spring", stiffness: 200 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-primary/30 bg-primary/5 flex items-center justify-center text-primary font-bold text-xl transition-all duration-300 group-hover:border-primary group-hover:shadow-[0_0_25px_-5px_hsl(142_71%_45%/0.5)]">
                {m.initials}
              </div>
              <motion.div
                className="absolute -inset-1 rounded-full border border-primary/10"
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
              />
            </div>
            <div>
              <p className="font-semibold text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{m.role}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Team;
