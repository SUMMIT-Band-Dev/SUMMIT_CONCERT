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
  const [forceVisible, setForceVisible] = useState(false);

  useEffect(() => {
    const navigationEntry = performance.getEntriesByType("navigation").at(0) as
      | PerformanceNavigationTiming
      | undefined;
    const isBackForwardNavigation = navigationEntry?.type === "back_forward";
    const hasExternalReferrer =
      document.referrer.length > 0 &&
      !document.referrer.startsWith(window.location.origin);

    if (isBackForwardNavigation || hasExternalReferrer) {
      requestAnimationFrame(() => {
        setForceVisible(true);
      });
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      // 외부 페이지에서 뒤로가기로 복원(bfcache)될 때는
      // 초기 opacity 상태에 머무르지 않도록 즉시 표시 상태로 전환한다.
      if (event.persisted) {
        setForceVisible(true);
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const adjustedDelay = delay;
  const adjustedDuration = duration;
  const adjustedY = y;
  const viewportAmount = 0.18;
  const finalTransition = {
    duration: adjustedDuration,
    delay: adjustedDelay,
    ease: "easeOut" as const,
  };

  return (
    <motion.div
      className={className}
      initial={forceVisible ? false : { opacity: 0, y: adjustedY }}
      animate={forceVisible ? { opacity: 1, y: 0 } : undefined}
      whileInView={forceVisible ? undefined : { opacity: 1, y: 0 }}
      viewport={forceVisible ? undefined : { once, amount: viewportAmount }}
      transition={finalTransition}
    >
      {children}
    </motion.div>
  );
}
