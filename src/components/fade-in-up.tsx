"use client";

import { motion } from "framer-motion";
import { useEffect, useState, type PropsWithChildren } from "react";

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
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    updateScreenWidth();
    window.addEventListener("resize", updateScreenWidth);

    return () => {
      window.removeEventListener("resize", updateScreenWidth);
    };
  }, []);

  const isDesktop = screenWidth >= 1024;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;

  const adjustedDelay = isDesktop ? delay * 0.65 : isTablet ? delay * 0.8 : delay;
  const adjustedDuration = isDesktop
    ? duration + 0.12
    : isTablet
      ? duration + 0.06
      : duration;
  const adjustedY = isDesktop ? y * 0.7 : isTablet ? y * 0.85 : y;
  const viewportAmount = isDesktop ? 0.14 : isTablet ? 0.16 : 0.2;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: adjustedY }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: viewportAmount }}
      transition={{ duration: adjustedDuration, delay: adjustedDelay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
