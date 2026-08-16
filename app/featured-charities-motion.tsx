"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  is_featured: boolean;
};

export default function FeaturedCharitiesMotion({
  charities,
}: {
  charities: Charity[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-16"
    >
      <h2 className="font-display text-lg italic text-paper">
        Featured charities
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {charities.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
            className="panel space-y-2 p-5"
          >
            {c.is_featured && <span className="stamp-sand">Featured</span>}
            <h3 className="font-display text-base italic text-paper">
              {c.name}
            </h3>
            {c.description && (
              <p className="text-sm text-paper/60">{c.description}</p>
            )}
          </motion.div>
        ))}
      </div>
      <Link
        href="/charities"
        className="mt-4 inline-block text-sm text-sand underline underline-offset-2"
      >
        See all charities →
      </Link>
    </motion.div>
  );
}
