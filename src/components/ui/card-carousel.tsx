"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";
import { useEffect, useState } from "react";
import FadeInUp from "@/components/common/fade-in-up";
import { supabase } from "@/lib/supabase";

type SetlistItem = {
  id: number;
  team_name: string;
  day: string;
  image_src: string;
};

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
      x: 116 * direction,
      scale: 0.84,
      rotateY: -36 * direction,
      z: 40,
      opacity: 0.78,
      zIndex: 20,
    };
  }

  if (absIndex === 2) {
    return {
      x: 180 * direction,
      scale: 0.68,
      rotateY: -42 * direction,
      z: -28,
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
  const router = useRouter();
  const [posterCards, setPosterCards] = useState<SetlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("mobile");
  const totalCards = posterCards.length;
  const safeActiveIndex =
    totalCards === 0 ? 0 : Math.min(activeIndex, totalCards - 1);
  const visibleRange =
    viewportMode === "desktop" ? 4 : viewportMode === "tablet" ? 3 : 2;
  const slideStep = viewportMode === "desktop" ? 2 : 1;
  const activeCard = totalCards > 0 ? posterCards[safeActiveIndex] : null;

  useEffect(() => {
    let isMounted = true;

    const fetchSetlist = async () => {
      try {
        const tableCandidates = ["Line Up", "line_up", "Setlist", "setlist"];
        let loadedRows: SetlistItem[] = [];

        for (const tableName of tableCandidates) {
          const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .order("id", { ascending: true });

          if (error || !data || data.length === 0) {
            continue;
          }

          loadedRows = (data as Array<Record<string, unknown>>)
            .map((row) => {
              const id = typeof row.id === "number" ? row.id : Number(row.id);
              const teamNameRaw =
                typeof row.team_name === "string"
                  ? row.team_name
                  : typeof row.team === "string"
                    ? row.team
                    : "";
              const dayRaw = typeof row.day === "string" ? row.day : "";
              const imageRaw =
                typeof row.image_src === "string" ? row.image_src : "";
              const normalizedImageRaw = imageRaw
                .trim()
                .replaceAll("\\", "/")
                .replace(/^(public|dist)\//i, "");
              const imageSrc = normalizedImageRaw
                ? normalizedImageRaw.startsWith("/") ||
                  normalizedImageRaw.startsWith("http")
                  ? normalizedImageRaw
                  : `/${normalizedImageRaw}`
                : "";

              if (!Number.isFinite(id) || !teamNameRaw || !imageSrc) {
                return null;
              }

              return {
                id,
                team_name: teamNameRaw,
                day: dayRaw || "SUMMIT",
                image_src: imageSrc,
              } satisfies SetlistItem;
            })
            .filter((item): item is SetlistItem => item !== null);

          if (loadedRows.length > 0) {
            break;
          }
        }

        if (isMounted) {
          setPosterCards(loadedRows);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchSetlist();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const moveCard = (direction: 1 | -1, step = 1) => {
    if (totalCards === 0) {
      return;
    }

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
    <section className="relative overflow-hidden px-5 pb-16 pt-10 md:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 z-[5] md:hidden">
        <div className="mobile-setlist-motion-bg" />
      </div>

      <div className="relative z-10">
      <FadeInUp delay={0.06} once={false}>
        <Link
          href="/setlist"
          className="inline-block text-[32px] font-semibold leading-[38px] transition-opacity hover:opacity-80 md:text-[44px] md:leading-[52px]"
        >
          셋리스트
        </Link>
      </FadeInUp>
      <FadeInUp delay={0.12} once={false}>
        <p className="mb-0 mt-2 text-[18px] leading-[21.48px] text-white/70 md:mt-3">
          좌우로 드래그해서 포스터를 넘겨보세요.
        </p>
      </FadeInUp>

      {isLoading ? (
        <FadeInUp delay={0.2} once={false}>
          <div className="mt-20 flex h-[340px] items-center justify-center text-white/50">
            포스터를 불러오는 중입니다...
          </div>
        </FadeInUp>
      ) : totalCards === 0 ? (
        <FadeInUp delay={0.2} once={false}>
          <div className="mt-20 flex h-[340px] items-center justify-center text-white/50">
            아직 등록된 포스터가 없습니다.
          </div>
        </FadeInUp>
      ) : (
        <>
          <FadeInUp delay={0.2} once={false}>
            <div
              className="relative mt-20 h-[308px] w-full overflow-visible md:mt-16 md:h-[356px] lg:mt-12 lg:h-[376px]"
              style={{ perspective: "1000px" }}
            >
              <button
                type="button"
                aria-label="이전 포스터로 이동"
                onClick={() => moveCard(-1, 1)}
                className="absolute inset-y-0 left-0 z-40 w-[36%] cursor-w-resize bg-transparent"
              />
              <button
                type="button"
                aria-label="다음 포스터로 이동"
                onClick={() => moveCard(1, 1)}
                className="absolute inset-y-0 right-0 z-40 w-[36%] cursor-e-resize bg-transparent"
              />

              {posterCards.map((card, index) => {
                const relativeIndex = getCircularDistance(
                  index,
                  safeActiveIndex,
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
                    className="absolute left-1/2 top-0 h-[286px] w-[196px] -translate-x-1/2 cursor-grab active:cursor-grabbing md:h-[326px] md:w-[228px] lg:h-[338px] lg:w-[240px]"
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
                    onClick={() => router.push("/setlist")}
                    whileHover={{ scale: motionConfig.scale * 1.04 }}
                    whileTap={{ scale: motionConfig.scale * 0.98 }}
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20">
                      <Image
                        src={card.image_src}
                        alt={`${card.team_name} ${card.day} 포스터`}
                        fill
                        unoptimized
                        className="object-cover object-center"
                        sizes="(min-width: 1280px) 240px, (min-width: 768px) 228px, 196px"
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </FadeInUp>

          <FadeInUp delay={0.24} once={false}>
            <div className="mt-5 min-h-[86px] text-center">
              {activeCard ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <div className="mx-auto flex max-w-[360px] items-center justify-center gap-4 md:max-w-[440px] md:gap-5">
                    <button
                      type="button"
                      aria-label="이전 포스터"
                      onClick={() => moveCard(-1, 1)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-[24px] leading-none text-white transition-colors hover:bg-white/10 md:h-11 md:w-11 md:text-[26px]"
                    >
                      ‹
                    </button>
                    <p className="text-[24px] font-semibold leading-tight md:text-[30px]">
                      {activeCard.team_name}
                    </p>
                    <button
                      type="button"
                      aria-label="다음 포스터"
                      onClick={() => moveCard(1, 1)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-[24px] leading-none text-white transition-colors hover:bg-white/10 md:h-11 md:w-11 md:text-[26px]"
                    >
                      ›
                    </button>
                  </div>
                  <p className="mt-3 text-[15px] font-medium text-white/65 md:text-[17px]">
                    {activeCard.day} Artist
                  </p>
                </motion.div>
              ) : null}
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
                    index === safeActiveIndex
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </FadeInUp>
        </>
      )}
      </div>
    </section>
  );
}
