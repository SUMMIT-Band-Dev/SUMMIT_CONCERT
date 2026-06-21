import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/layout/site-header";

export default function Desktop404Page() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />

      <main className="relative isolate min-h-screen overflow-hidden pt-16 md:pt-[84px] lg:pt-[102px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/concert-poster-latest.png"
            alt="404 배경"
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-black/45" />
        </div>

        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] w-full items-center justify-center px-5 md:min-h-[calc(100svh-84px)] md:px-8 lg:min-h-[calc(100svh-102px)] lg:px-[72px]">
          <div className="flex w-full max-w-[430px] flex-col items-center text-center">
            <h1 className="text-[44px] font-semibold leading-[52px] md:text-[48px] md:leading-[57px]">
              COMING SOON!
            </h1>
            <p className="mt-3 text-[32px] font-medium leading-[38px] text-white/95 md:text-[34px] md:leading-[40px]">
              웹페이지 작업중입니다:)
            </p>
            <p className="mt-2 text-[32px] font-medium leading-[38px] text-white/95 md:text-[34px] md:leading-[40px]">
              조금만 기다려주세요!
            </p>

            <Link
              href="/"
              className="mt-8 inline-flex h-[74px] w-[255px] items-center justify-center rounded-[16px] bg-[#181436]/80 text-[40px] font-medium leading-none text-white transition-opacity hover:opacity-90"
              style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}
            >
              돌아가기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
