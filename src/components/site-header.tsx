"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const setlistMenuItems = ["Setlist"];
const facilityMenuItems = [
  "공연장 안내",
  "타임 테이블",
  "티켓 안내",
  "이벤트 및 굿즈",
  "오시는 길",
  "관람 유의사항",
];

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed left-1/2 top-0 z-50 flex h-16 w-full max-w-[430px] -translate-x-1/2 items-center justify-between bg-black px-5">
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
          className="relative flex h-6 w-6 items-center justify-center"
        >
          <span
            className={`absolute block h-[2px] w-[18px] rounded-full bg-white transition-transform duration-300 ${
              isMenuOpen ? "rotate-45" : "-translate-y-[5px]"
            }`}
          />
          <span
            className={`absolute block h-[2px] w-[18px] rounded-full bg-white transition-opacity duration-300 ${
              isMenuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute block h-[2px] w-[18px] rounded-full bg-white transition-transform duration-300 ${
              isMenuOpen ? "-rotate-45" : "translate-y-[5px]"
            }`}
          />
        </button>
      </header>

      <AnimatePresence mode="sync">
        {isMenuOpen ? (
          <motion.div
            key="concert-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-40 bg-black/90"
          >
            <motion.nav
              initial={{ opacity: 0, y: -28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -28 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="mx-auto h-full w-full max-w-[430px] px-5 pt-[104px]"
            >
              <section>
                <h2 className="text-[28px] font-semibold leading-[33.41px] text-white">
                  Setlist
                </h2>
                <div className="mt-4 h-px w-full bg-white" />
                <ul className="mt-3 space-y-3">
                  {setlistMenuItems.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="text-left text-[20px] font-semibold leading-[23.87px] text-[#ababab] transition-colors hover:text-white"
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-[66px]">
                <h2 className="text-[28px] font-semibold leading-[33.41px] text-white">
                  시설 및 서비스
                </h2>
                <div className="mt-4 h-px w-full bg-white" />
                <ul className="mt-3 space-y-4">
                  {facilityMenuItems.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="text-left text-[20px] font-semibold leading-[23.87px] text-[#ababab] transition-colors hover:text-white"
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
