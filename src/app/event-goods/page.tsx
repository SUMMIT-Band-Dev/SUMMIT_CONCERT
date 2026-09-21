import { fetchLineUpRows, fetchSetlistRows } from "@/lib/fetch-line-up-and-setlist";
import { buildTeamsByDay, buildTracksByTeamId } from "@/lib/line-up";
import EventGoodsView from "@/components/sections/event-goods-view";
import FadeInUp from "@/components/common/fade-in-up";

export default async function EventGoodsPage() {
  const [lineUpRows, setlistRows] = await Promise.all([
    fetchLineUpRows(),
    fetchSetlistRows(),
  ]);
  const teamsByDay = buildTeamsByDay(
    lineUpRows,
    buildTracksByTeamId(setlistRows, lineUpRows),
  );

  return (
    <main className="relative min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
      <section className="relative z-10 mx-auto w-full max-w-245 px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-14 lg:px-12">
        <FadeInUp delay={0.04}>
          <h1 className="text-center text-[24px] font-semibold leading-[1.24] md:text-[34px] lg:text-[40px]">
            셋리스트 전체 보기
          </h1>
          <p className="mt-3 text-center text-[13px] leading-[1.6] text-white/75 md:text-[15px]">
            1일차 · 2일차를 선택해 공연 셋리스트를 확인할 수 있습니다.
          </p>
        </FadeInUp>

        <EventGoodsView teamsByDay={teamsByDay} />
      </section>
    </main>
  );
}
