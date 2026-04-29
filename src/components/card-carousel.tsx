"use client";

import Image from "next/image";
import { motion, type PanInfo } from "framer-motion";
import { useState } from "react";
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
    imageSrc: "/concert-poster.png",
  },
  {
    id: 2,
    title: "WINTER SUMMIT",
    subtitle: "SECOND STAGE",
    imageSrc: "/concert-poster.png",
  },
  {
    id: 3,
    title: "WINTER SUMMIT",
    subtitle: "SPECIAL SESSION",
    imageSrc: "/concert-poster.png",
  },
  {
    id: 4,
    title: "WINTER SUMMIT",
    subtitle: "NIGHT PROGRAM",
    imageSrc: "/concert-poster.png",
  },
  {
    id: 5,
    title: "WINTER SUMMIT",
    subtitle: "FINAL ENCORE",
    imageSrc: "/concert-poster.png",
  },
];

const SWIPE_THRESHOLD = 7000;

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

function getCardMotion(relativeIndex: number) {
  if (relativeIndex === 0) {
    return { x: 0, scale: 1, rotateY: 0, z: 120, opacity: 1, zIndex: 30 };
  }

  if (relativeIndex === -1) {
    return {
      x: -170,
      scale: 0.9,
      rotateY: 32,
      z: 40,
      opacity: 0.9,
      zIndex: 20,
    };
  }

  if (relativeIndex === 1) {
    return {
      x: 170,
      scale: 0.9,
      rotateY: -32,
      z: 40,
      opacity: 0.9,
      zIndex: 20,
    };
  }

  if (relativeIndex === -2) {
    return {
      x: -290,
      scale: 0.78,
      rotateY: 45,
      z: -20,
      opacity: 0.5,
      zIndex: 10,
    };
  }

  if (relativeIndex === 2) {
    return {
      x: 290,
      scale: 0.78,
      rotateY: -45,
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
  const totalCards = posterCards.length;

  const moveCard = (direction: 1 | -1) => {
    setActiveIndex(
      (prevIndex) => (prevIndex + direction + totalCards) % totalCards,
    );
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const swipe = swipePower(info.offset.x, info.velocity.x);

    if (swipe < -SWIPE_THRESHOLD) {
      moveCard(1);
    } else if (swipe > SWIPE_THRESHOLD) {
      moveCard(-1);
    }
  };

  return (
    <section className="px-4 pb-16 pt-10">
      <FadeInUp delay={0.06} once={false}>
        <h2 className="font-semibold text-[32px]">Setlist</h2>
      </FadeInUp>
      <FadeInUp delay={0.12} once={false}>
        <p className="mt-1 text-sm text-white/70">
          좌우로 드래그해서 포스터를 넘겨보세요.
        </p>
      </FadeInUp>

      <FadeInUp delay={0.2} once={false}>
        <div
          className="relative mt-10 h-[340px] w-full overflow-visible"
          style={{ perspective: "1000px" }}
        >
          {posterCards.map((card, index) => {
            const relativeIndex = getCircularDistance(
              index,
              activeIndex,
              totalCards,
            );
            const motionConfig = getCardMotion(relativeIndex);

            if (Math.abs(relativeIndex) > 2) {
              return null;
            }

            return (
              <motion.button
                key={card.id}
                type="button"
                className="absolute left-1/2 top-0 h-[320px] w-[220px] -translate-x-1/2 cursor-grab active:cursor-grabbing"
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
                  stiffness: 260,
                  damping: 28,
                  mass: 0.85,
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveIndex(index)}
                whileTap={{ scale: motionConfig.scale * 0.98 }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20">
                  <Image
                    src={card.imageSrc}
                    alt={`${card.title} ${card.subtitle} 포스터`}
                    fill
                    className="object-cover object-center"
                    sizes="220px"
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
