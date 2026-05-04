"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const menuSections = [
  {
    title: "셋리스트",
    items: ["셋리스트"],
  },
  {
    title: "시설 및 서비스",
    items: ["공연장 안내", "타임 테이블", "티켓 안내", "이벤트 및 굿즈", "오시는 길", "관람 유의사항"],
  },
];

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 w-full">
        <div className="flex h-[64px] w-full items-center justify-between border-b border-[#6a6a6a] bg-black px-5 md:px-6 lg:px-8">
          <p
            className="text-[18px] leading-[19.8px]"
            style={{ fontFamily: '"Puradak Gentle Gothic OTF", Pretendard, sans-serif' }}
          >
            SUMMIT
          </p>

          <button
            type="button"
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white sm:text-sm"
          >
            <span>LIST</span>
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span
                className={`absolute block h-[2px] w-[16px] rounded-full bg-white transition-transform duration-300 ${
                  isMenuOpen ? "rotate-45" : "-translate-y-[4px]"
                }`}
              />
              <span
                className={`absolute block h-[2px] w-[16px] rounded-full bg-white transition-opacity duration-300 ${
                  isMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute block h-[2px] w-[16px] rounded-full bg-white transition-transform duration-300 ${
                  isMenuOpen ? "-rotate-45" : "translate-y-[4px]"
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      <AnimatePresence mode="sync">
        {isMenuOpen ? (
          <motion.div
            key="concert-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-40 bg-black/90 backdrop-blur-[1px]"
          >
            <motion.nav
              initial={{ opacity: 0, y: -28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -28 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              aria-label="전체 메뉴"
              className="mx-auto h-full w-full max-w-[1380px] overflow-y-auto px-6 pb-14 pt-[104px] md:px-12 lg:px-20"
            >
              <div className="space-y-12 md:space-y-16">
                {menuSections.map((section) => (
                  <section key={section.title}>
                    <h2 className="text-[22px] font-semibold leading-[1.2] text-white md:text-[36px]">
                      {section.title}
                    </h2>
                    <div className="mt-3 h-px w-full bg-white/70 md:mt-5" />
                    <ul className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 md:mt-6 md:gap-x-10">
                      {section.items.map((item) => (
                        <li key={item}>
                          <button
                            type="button"
                            className="text-left text-[15px] font-semibold leading-[1.35] text-[#b0b0b0] transition-colors hover:text-white md:text-[22px]"
                          >
                            {item}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
