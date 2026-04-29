"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";

type FadeInUpProps = PropsWithChildren<{
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
  once?: boolean;
}>;

export default function FadeInUp({
  children,
  className,
  delay = 0,
  duration = 0.55,
  y = 28,
  once = true,
}: FadeInUpProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
