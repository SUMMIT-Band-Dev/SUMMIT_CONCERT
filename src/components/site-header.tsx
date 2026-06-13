"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

const menuSections = [
  {
    title: "셋리스트",
    items: ["홈", "예매하기", "셋리스트"],
  },
  {
    title: "시설 및 서비스",
    items: ["공연장 안내", "타임 테이블", "티켓 안내", "이벤트 및 굿즈", "오시는 길", "관람 유의사항"],
  },
];

const headerNavItems = ["홈", "예매하기", "셋리스트", "시설 및 서비스"];

const mobileMenuHrefByItem: Record<string, string> = {
  홈: "/",
  예매하기: "/book",
  셋리스트: "/setlist",
  "공연장 안내": "https://flexlounge.creatorlink.net/",
  "타임 테이블": "/time-table",
  "티켓 안내": "/desktop-404",
  "이벤트 및 굿즈": "/desktop-404",
  "오시는 길": "/desktop-404",
  "관람 유의사항": "/desktop-404",
};

const headerNavHrefByItem: Record<string, string> = {
  홈: "/",
  예매하기: "/book",
  셋리스트: "/setlist",
  "시설 및 서비스": "/#facility-service",
};

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 w-full">
        <div className="flex h-[64px] w-full items-center justify-between border-b border-white/35 bg-black/20 px-5 backdrop-blur-[2px] md:h-[84px] md:px-8 lg:h-[102px] lg:px-[72px]">
          <Link
            href="/"
            className="text-[18px] leading-[19.8px] transition-opacity hover:opacity-80 md:text-[32px] md:leading-[1.15] lg:text-[40px] lg:leading-[45.8px]"
            style={{ fontFamily: '"GangwonEduAll", Pretendard, sans-serif' }}
          >
            SUMMIT
          </Link>

          <nav className="hidden items-center text-white md:flex md:gap-8 md:text-[22px] md:font-bold md:leading-[26px] lg:gap-12 lg:text-[28px] lg:leading-[33.41px]">
            {headerNavItems.map((item) => (
              headerNavHrefByItem[item] ? (
                <Link
                  key={item}
                  href={headerNavHrefByItem[item]}
                  className="transition-opacity duration-200 hover:opacity-80"
                  style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}
                >
                  {item}
                </Link>
              ) : (
                <button
                  key={item}
                  type="button"
                  className="transition-opacity duration-200 hover:opacity-80"
                  style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}
                >
                  {item}
                </button>
              )
            ))}
          </nav>

          <button
            type="button"
            aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white sm:text-sm md:hidden"
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
            className="fixed inset-0 z-40 bg-black/90 backdrop-blur-[1px] md:hidden"
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
                          {mobileMenuHrefByItem[item] ? (
                            mobileMenuHrefByItem[item].startsWith("http") ? (
                              <a
                                href={mobileMenuHrefByItem[item]}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-left text-[15px] font-semibold leading-[1.35] text-[#b0b0b0] transition-colors hover:text-white md:text-[22px]"
                              >
                                {item}
                              </a>
                            ) : (
                              <Link
                                href={mobileMenuHrefByItem[item]}
                                onClick={() => setIsMenuOpen(false)}
                                className="text-left text-[15px] font-semibold leading-[1.35] text-[#b0b0b0] transition-colors hover:text-white md:text-[22px]"
                              >
                                {item}
                              </Link>
                            )
                          ) : (
                            <button
                              type="button"
                              className="text-left text-[15px] font-semibold leading-[1.35] text-[#b0b0b0] transition-colors hover:text-white md:text-[22px]"
                            >
                              {item}
                            </button>
                          )}
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
