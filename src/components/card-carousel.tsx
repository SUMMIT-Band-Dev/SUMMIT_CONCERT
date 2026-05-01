"use client";

import Image from "next/image";
import { motion, type PanInfo } from "framer-motion";
import { useEffect, useState } from "react";
import FadeInUp from "@/components/fade-in-up";

type PosterCard = {
  id: number;
  title: string;
  subtitle: string;
  imageSrc: string;
};

const posterCards: PosterCard[] = [
  {
    id: 1,
    title: "WINTER SUMMIT",
    subtitle: "MAIN STAGE",
    imageSrc: "/setlist-first-thu.png",
  },
  {
    id: 2,
    title: "WINTER SUMMIT",
    subtitle: "SECOND STAGE",
    imageSrc: "/setlist-team.png",
  },
  {
    id: 3,
    title: "WINTER SUMMIT",
    subtitle: "SPECIAL SESSION",
    imageSrc: "/setlist-last.png",
  },
  {
    id: 4,
    title: "WINTER SUMMIT",
    subtitle: "NIGHT PROGRAM",
    imageSrc: "/setlist-first-thu.png",
  },
  {
    id: 5,
    title: "WINTER SUMMIT",
    subtitle: "FINAL ENCORE",
    imageSrc: "/setlist-team.png",
  },
  {
    id: 6,
    title: "WINTER SUMMIT",
    subtitle: "OPENING ACT",
    imageSrc: "/setlist-last.png",
  },
  {
    id: 7,
    title: "WINTER SUMMIT",
    subtitle: "AFTER PARTY",
    imageSrc: "/setlist-first-thu.png",
  },
];

const SWIPE_THRESHOLD = 7000;
type ViewportMode = "mobile" | "tablet" | "desktop";

function getViewportMode(width: number): ViewportMode {
  if (width >= 1280) {
    return "desktop";
  }
  if (width >= 768) {
    return "tablet";
  }
  return "mobile";
}

function getCircularDistance(
  index: number,
  activeIndex: number,
  length: number,
) {
  const rawDistance = index - activeIndex;
  const wrappedDistance =
    rawDistance > length / 2
      ? rawDistance - length
      : rawDistance < -length / 2
        ? rawDistance + length
        : rawDistance;

  return wrappedDistance;
}

function getCardMotion(relativeIndex: number, viewportMode: ViewportMode) {
  const direction = relativeIndex < 0 ? -1 : 1;
  const absIndex = Math.abs(relativeIndex);

  if (absIndex === 0) {
    return { x: 0, scale: 1.04, rotateY: 0, z: 150, opacity: 1, zIndex: 50 };
  }

  if (viewportMode === "desktop") {
    if (absIndex === 1) {
      return {
        x: 214 * direction,
        scale: 0.88,
        rotateY: -32 * direction,
        z: 70,
        opacity: 0.84,
        zIndex: 30,
      };
    }
    if (absIndex === 2) {
      return {
        x: 410 * direction,
        scale: 0.83,
        rotateY: -36 * direction,
        z: 20,
        opacity: 0.66,
        zIndex: 20,
      };
    }
    if (absIndex === 3) {
      return {
        x: 560 * direction,
        scale: 0.74,
        rotateY: -44 * direction,
        z: -25,
        opacity: 0.42,
        zIndex: 10,
      };
    }
    if (absIndex === 4) {
      return {
        x: 700 * direction,
        scale: 0.66,
        rotateY: -48 * direction,
        z: -70,
        opacity: 0.2,
        zIndex: 5,
      };
    }
  }

  if (viewportMode === "tablet") {
    if (absIndex === 1) {
      return {
        x: 182 * direction,
        scale: 0.87,
        rotateY: -34 * direction,
        z: 50,
        opacity: 0.82,
        zIndex: 30,
      };
    }
    if (absIndex === 2) {
      return {
        x: 320 * direction,
        scale: 0.79,
        rotateY: -40 * direction,
        z: -5,
        opacity: 0.56,
        zIndex: 20,
      };
    }
    if (absIndex === 3) {
      return {
        x: 430 * direction,
        scale: 0.72,
        rotateY: -45 * direction,
        z: -40,
        opacity: 0.3,
        zIndex: 10,
      };
    }
  }

  if (absIndex === 1) {
    return {
      x: 162 * direction,
      scale: 0.86,
      rotateY: -36 * direction,
      z: 40,
      opacity: 0.8,
      zIndex: 20,
    };
  }

  if (absIndex === 2) {
    return {
      x: 290 * direction,
      scale: 0.78,
      rotateY: -45 * direction,
      z: -20,
      opacity: 0.5,
      zIndex: 10,
    };
  }

  return { x: 0, scale: 0.7, rotateY: 0, z: -80, opacity: 0, zIndex: 0 };
}

function swipePower(offset: number, velocity: number) {
  return Math.abs(offset) * velocity;
}

export default function CardCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("mobile");
  const totalCards = posterCards.length;
  const visibleRange =
    viewportMode === "desktop" ? 4 : viewportMode === "tablet" ? 3 : 2;
  const slideStep = viewportMode === "desktop" ? 2 : 1;

  useEffect(() => {
    const updateViewportMode = () => {
      setViewportMode(getViewportMode(window.innerWidth));
    };

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    const autoplayTimer = window.setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % totalCards);
    }, 3000);

    return () => {
      window.clearInterval(autoplayTimer);
    };
  }, [totalCards]);

  const moveCard = (direction: 1 | -1, step = 1) => {
    setActiveIndex(
      (prevIndex) => (prevIndex + direction * step + totalCards) % totalCards,
    );
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const swipe = swipePower(info.offset.x, info.velocity.x);

    if (swipe < -SWIPE_THRESHOLD) {
      moveCard(1, slideStep);
    } else if (swipe > SWIPE_THRESHOLD) {
      moveCard(-1, slideStep);
    }
  };

  return (
    <section className="px-4 pb-16 pt-10 md:px-6 lg:px-8">
      <FadeInUp delay={0.06} once={false}>
        <h2 className="text-[32px] font-semibold leading-[38px] md:text-[44px] md:leading-[52px]">
          셋리스트
        </h2>
      </FadeInUp>
      <FadeInUp delay={0.12} once={false}>
        <p className="mb-0 mt-2 text-[18px] leading-[21.48px] text-white/70 md:mt-3">
          좌우로 드래그해서 포스터를 넘겨보세요.
        </p>
      </FadeInUp>

      <FadeInUp delay={0.2} once={false}>
        <div
          className="relative mt-20 h-[340px] w-full overflow-visible md:mt-16 md:h-[396px] lg:mt-12 lg:h-[418px]"
          style={{ perspective: "1000px" }}
        >
          {posterCards.map((card, index) => {
            const relativeIndex = getCircularDistance(
              index,
              activeIndex,
              totalCards,
            );
            const motionConfig = getCardMotion(relativeIndex, viewportMode);

            if (Math.abs(relativeIndex) > visibleRange) {
              return null;
            }

            return (
              <motion.button
                key={card.id}
                type="button"
                className="absolute left-1/2 top-0 h-[320px] w-[220px] -translate-x-1/2 cursor-grab active:cursor-grabbing md:h-[363px] md:w-[253px] lg:h-[374px] lg:w-[264px]"
                style={{
                  zIndex: motionConfig.zIndex,
                  transformStyle: "preserve-3d",
                }}
                animate={{
                  x: motionConfig.x,
                  scale: motionConfig.scale,
                  rotateY: motionConfig.rotateY,
                  z: motionConfig.z,
                  opacity: motionConfig.opacity,
                }}
                transition={{
                  type: "spring",
                  stiffness: 100, //강성, 스프링의 단단함
                  damping: 40, //감쇠, 흔들림을 죽이는 힘
                  mass: 1.45, //질량, 물체 무게감
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveIndex(index)}
                whileHover={{ scale: motionConfig.scale * 1.04 }}
                whileTap={{ scale: motionConfig.scale * 0.98 }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20">
                  <Image
                    src={card.imageSrc}
                    alt={`${card.title} ${card.subtitle} 포스터`}
                    fill
                    className="object-cover object-center"
                    sizes="(min-width: 1280px) 264px, (min-width: 768px) 253px, 220px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                    <p className="text-xs font-medium tracking-[0.12em] text-white/80">
                      {card.subtitle}
                    </p>
                    <p className="mt-1 text-lg font-semibold leading-tight">
                      {card.title}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </FadeInUp>

      <FadeInUp delay={0.26} once={false}>
        <div className="mt-5 flex items-center justify-center gap-2">
          {posterCards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              aria-label={`${index + 1}번째 카드로 이동`}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      </FadeInUp>
    </section>
  );
}
