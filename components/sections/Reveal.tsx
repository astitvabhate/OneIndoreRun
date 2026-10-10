'use client';

import { motion } from 'framer-motion';

/** Shared entrance animation for content blocks. */
export function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6 }}
    >
      {children}
    </motion.div>
  );
}
