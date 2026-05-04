"use client";

import Image from "next/image";
import { motion, type PanInfo } from "framer-motion";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import FadeInUp from "@/components/fade-in-up";

type SetlistItem = {
  id: number;
  team_name: string;
  day: string;
  image_src: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// 디버깅용: 환경 변수가 잘 들어오는지 콘솔에 출력 (배포 시에는 지울 것)
console.log("Supabase URL 확인:", supabaseUrl ? "정상" : "비어있음");
console.log("Supabase KEY 확인:", supabaseKey ? "정상" : "비어있음");

export const supabase = createClient(supabaseUrl, supabaseKey);

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
        const { data, error } = await supabase
          .from("setlist")
          .select("*")
          .order("id", { ascending: true });

        console.log("Fetched Data:", data);
        console.error("Fetch Error:", error);

        if (error) {
          return;
        }

        if (isMounted) {
          setPosterCards((data ?? []) as SetlistItem[]);
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

  useEffect(() => {
    if (totalCards === 0) {
      return;
    }

    const autoplayTimer = window.setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % totalCards);
    }, 3000);

    return () => {
      window.clearInterval(autoplayTimer);
    };
  }, [totalCards]);

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
              className="relative mt-20 h-[340px] w-full overflow-visible md:mt-16 md:h-[396px] lg:mt-12 lg:h-[418px]"
              style={{ perspective: "1000px" }}
            >
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
                        src={card.image_src}
                        alt={`${card.team_name} ${card.day} 포스터`}
                        fill
                        className="object-cover object-center"
                        sizes="(min-width: 1280px) 264px, (min-width: 768px) 253px, 220px"
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </FadeInUp>

          <FadeInUp delay={0.24} once={false}>
            <div className="mt-5 min-h-[74px] text-center">
              {activeCard ? (
                <motion.div
                  key={safeActiveIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <p className="text-[24px] font-semibold leading-tight md:text-[30px]">
                    {activeCard.team_name}
                  </p>
                  <p className="mt-2 text-[15px] font-medium text-white/65 md:text-[17px]">
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
                    index === safeActiveIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </FadeInUp>
        </>
      )}
    </section>
  );
}
