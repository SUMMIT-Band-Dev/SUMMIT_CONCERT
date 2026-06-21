import FadeInUp from "@/components/common/fade-in-up";

export default function SummitFooterSection() {
  return (
    <FadeInUp delay={0.22}>
      <footer className="border-t border-white/30 pt-9 md:pt-12">
        <h3 className="text-[32px] font-semibold leading-[38px] md:text-[44px] md:leading-[52px]">
          SUMMIT
        </h3>
        <div className="mt-6 space-y-2 text-[clamp(13px,3.4vw,19px)] font-medium leading-[1.32] text-white/90 md:mt-7">
          <p>
            <span className="font-medium">소속</span>
            <span className="ml-4 font-normal">숭실대학교 IT대학 X AI대학 연합 밴드 소모임</span>
          </p>
          <p>
            <span className="font-semibold">E-Mail</span>
            <span className="ml-4 font-normal">itsummit2022@gmail.com</span>
          </p>
        </div>
        <div className="mt-6 border-t border-white/30 pt-5 text-[clamp(10px,2.6vw,13px)] leading-[1.3] text-white/85 md:mt-8 md:pt-6">
          <p>Copyright © 2026 IT대학 X AI대학 밴드 소모임 SUMMIT.</p>
          <p>All rights reserved.</p>
        </div>
      </footer>
    </FadeInUp>
  );
}
