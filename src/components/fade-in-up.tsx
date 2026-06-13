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
  const [forceVisible, setForceVisible] = useState(false);

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

  useEffect(() => {
    const navigationEntry = performance
      .getEntriesByType("navigation")
      .at(0) as PerformanceNavigationTiming | undefined;
    const isBackForwardNavigation = navigationEntry?.type === "back_forward";
    const hasExternalReferrer =
      document.referrer.length > 0 && !document.referrer.startsWith(window.location.origin);

    // 브라우저/플랫폼에 따라 pageshow.persisted가 false로 들어오는 경우가 있어
    // 뒤로가기 네비게이션 타입/외부 referrer도 함께 체크해 즉시 표시한다.
    if (isBackForwardNavigation || hasExternalReferrer) {
      setForceVisible(true);
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

  const isDesktop = screenWidth >= 1024;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;

  const adjustedDelay = isDesktop
    ? delay * 0.65
    : isTablet
      ? delay * 0.8
      : delay;
  const adjustedDuration = isDesktop
    ? duration + 0.12
    : isTablet
      ? duration + 0.06
      : duration;
  const adjustedY = isDesktop ? y * 0.7 : isTablet ? y * 0.85 : y;
  const viewportAmount = isDesktop ? 0.14 : isTablet ? 0.16 : 0.2;
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
