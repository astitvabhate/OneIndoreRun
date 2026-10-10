'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { photos } from './content';

export function HeroSection() {
  return (
    <section className="hero">
      <Image src={photos[0]} fill priority sizes="100vw" alt="Runners on a city road" />
      <div className="heroShade" />
      <div className="heroContent">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">One Indore Run <i /> Indore 2.0</motion.p>
        <motion.h1 initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>RUN INDORE.<br /><em>FEEL ALIVE.</em></motion.h1>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="heroBottom">
          <p>RUN · COMMUNITY · CITY · ENERGY<br /><span><MapPin size={15} /> Indore, Madhya Pradesh</span></p>
        </motion.div>
      </div>
    </section>
  );
}
