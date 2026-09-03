"use client";
import Link from "next/link";
import { motion } from "framer-motion";
type Charity={id:string;name:string;description:string|null;is_featured:boolean};
const photos=["https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80","https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80","https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80"];
export default function FeaturedCharitiesMotion({charities}:{charities:Charity[]}){
  if(!charities.length) return null;
  return <motion.section initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.45}} className="py-3"><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Featured charities</p><h2 className="section-title mt-2">Play for something bigger.</h2></div><Link href="/charities" className="hidden text-sm font-semibold text-fairway sm:block">View all charities →</Link></div><div className="grid gap-4 sm:grid-cols-3">{charities.map((c,i)=><Link href={`/charities/${c.id}`} key={c.id} className="group photo-card"><div className="photo-cover" style={{backgroundImage:`url('${photos[i%photos.length]}')`}}/><div className="p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{c.name}</h3><span className="text-fairway">→</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/50">{c.description || "Making a meaningful impact in communities."}</p></div></Link>)}</div></motion.section>;
}
