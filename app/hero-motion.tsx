"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export default function HeroMotion({ signedIn = false }: { signedIn?: boolean }) {
  return <motion.section initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.5,ease:"easeOut"}} className="relative grid min-h-[440px] overflow-hidden rounded-card border border-line bg-white md:grid-cols-[.92fr_1.08fr]">
    <div className="relative z-10 flex flex-col justify-center p-7 sm:p-10 lg:p-14">
      <p className="eyebrow">Play golf. Make an impact.</p>
      <h1 className="mt-3 max-w-lg font-display text-5xl leading-[.98] sm:text-6xl">Play your round.<br/>Back a cause.<br/>Win real prizes.</h1>
      <p className="mt-6 max-w-md text-sm leading-6 text-ink/60">Enter your golf scores, support verified charities, and get a chance to win prizes — all while making a real difference.</p>
      <div className="mt-7 flex flex-wrap gap-3"><Link href={signedIn ? "/dashboard" : "/signup"} className="btn-primary">{signedIn ? "Go to dashboard" : "Get started"} <span className="ml-2">→</span></Link><Link href="/charities" className="btn-ghost">Browse charities</Link></div>
    </div>
    <div className="relative min-h-[290px] bg-cover bg-center" style={{backgroundImage:"url('https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=1200&q=90')"}}>
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/15 to-transparent"/><p className="absolute right-8 top-8 max-w-[130px] font-display text-right text-xl italic leading-tight text-ink/75">Better Rounds.<br/>Bigger Impact.</p>
    </div>
  </motion.section>;
}
