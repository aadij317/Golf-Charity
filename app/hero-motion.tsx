"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// Homepage is a Server Component (see app/page.tsx) so it can query
// charities directly without a client fetch waterfall. Framer Motion
// needs a client boundary, so just the hero text + CTAs are split out
// into this small wrapper rather than converting the whole page.
export default function HeroMotion() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-sand">
        Digital Heroes
      </p>
      <h1 className="mt-2 max-w-2xl font-display text-4xl italic text-paper sm:text-5xl">
        Play your round. Back a cause. Win real prizes.
      </h1>
      <p className="mt-5 max-w-xl text-paper/70">
        Subscribe monthly or yearly, submit your recent golf scores, and get
        entered into every draw — with a share of every subscription going
        straight to a charity you choose.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="btn-primary">
          Sign up
        </Link>
        <Link href="/charities" className="btn-ghost">
          Browse charities
        </Link>
        <Link href="/login" className="btn-ghost">
          Sign in
        </Link>
        <Link href="/draws" className="btn-ghost">
          Draw results
        </Link>
      </div>
    </motion.div>
  );
}
