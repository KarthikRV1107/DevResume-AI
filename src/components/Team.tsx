import { motion } from "framer-motion";

const members = [
  { initials: "BW", name: "B. Williams", role: "ML Engineer" },
  { initials: "WT", name: "W. Torres", role: "Full-Stack Dev" },
  { initials: "TK", name: "T. Kim", role: "Product & UX" },
];

const Team = () => (
  <section id="team" className="py-24">
    <div className="container mx-auto px-4 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold mb-4"
      >
        Built by <span className="text-gradient">BWT_Techies</span>
      </motion.h2>
      <p className="text-muted-foreground mb-12">The team behind DevResume AI.</p>

      <div className="flex flex-wrap justify-center gap-10">
        {members.map((m, i) => (
          <motion.div
            key={m.initials}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-20 h-20 rounded-full border-2 border-primary/30 bg-primary/5 flex items-center justify-center text-primary font-bold text-xl transition-all duration-300 group-hover:border-primary group-hover:shadow-[0_0_20px_-5px_hsl(142_71%_45%/0.4)]">
              {m.initials}
            </div>
            <div>
              <p className="font-semibold text-foreground">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.role}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Team;
