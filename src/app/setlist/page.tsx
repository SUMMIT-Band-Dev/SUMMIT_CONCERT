import { fetchLineUpRows, fetchSetlistRows } from "@/lib/fetch-line-up-and-setlist";
import { buildLineUpCards, buildTracksByTeamId } from "@/lib/line-up";
import FadeInUp from "@/components/common/fade-in-up";
import SetlistView from "@/components/sections/setlist-view";
import type { SetlistCard, TrackItem } from "@/types/setlist";

const setlistCards: SetlistCard[] = [
  {
    id: 1,
    day: 1,
    title: "8C8",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team1.png",
    isPosterDummy: false,
  },
  {
    id: 2,
    day: 1,
    title: "뉴비",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team2.png",
    isPosterDummy: false,
  },
  {
    id: 3,
    day: 1,
    title: "즐겜굴비",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team3.png",
    isPosterDummy: false,
  },
  {
    id: 4,
    day: 1,
    title: "써밋 음악도둑",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team4.png",
    isPosterDummy: false,
  },
  {
    id: 5,
    day: 1,
    title: "26살과 26학번",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team5.png",
    isPosterDummy: false,
  },
  {
    id: 6,
    day: 1,
    title: "하로로는노는게제일좋아",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team6.png",
    isPosterDummy: false,
  },
  {
    id: 7,
    day: 1,
    title: "숙취의 미학",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day1-team7.png",
    isPosterDummy: false,
  },
  {
    id: 8,
    day: 2,
    title: "오미자",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team1.png",
    isPosterDummy: false,
  },
  {
    id: 9,
    day: 2,
    title: "낭만치사랑",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team2.png",
    isPosterDummy: false,
  },
  {
    id: 10,
    day: 2,
    title: "쉬었음밴드",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team3.png",
    isPosterDummy: false,
  },
  {
    id: 11,
    day: 2,
    title: "머리위 쥑쥑이",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team4.png",
    isPosterDummy: false,
  },
  {
    id: 12,
    day: 2,
    title: "컴학 늙크크와 공주들",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team5.png",
    isPosterDummy: false,
  },
  {
    id: 13,
    day: 2,
    title: "모스붕어",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team6.png",
    isPosterDummy: false,
  },
  {
    id: 14,
    day: 2,
    title: "도레미파솔라석희",
    artist: "SUMMIT SUMMER CONCERT",
    imageSrc: "/day2-team7.png",
    isPosterDummy: false,
  },
];

async function buildSetlistData(): Promise<{
  cardsData: SetlistCard[];
  trackItemsByTeamId: Record<number, TrackItem[]>;
}> {
  const [lineUpRows, setlistRows] = await Promise.all([
    fetchLineUpRows(),
    fetchSetlistRows(),
  ]);

  // 1) 카드/팀명/포스터는 Line Up 기준. 일차·팀명·이미지가 모두 있는 팀만 노출한다.
  const lineUpCards = buildLineUpCards(lineUpRows);
  const cardsData = lineUpCards.length > 0 ? lineUpCards : setlistCards;

  // 2) 곡 목록은 Setlist(title/singer/teamId) 기준, Line Up.id 로 매칭
  const trackItemsByTeamId = buildTracksByTeamId(setlistRows, lineUpRows);

  return { cardsData, trackItemsByTeamId };
}

export default async function SetlistPage() {
  const { cardsData, trackItemsByTeamId } = await buildSetlistData();

  return (
    <main className="relative min-h-screen overflow-hidden pt-16 md:pt-21 lg:pt-25.5">
      <section className="relative z-10 mx-auto w-full max-w-360 px-5 pb-20 pt-10 md:px-8 md:pb-24 md:pt-16 lg:px-18 lg:pt-24">
        <FadeInUp delay={0.04}>
          <h1 className="text-[28px] font-semibold leading-[33.4px] md:text-[32px] md:leading-9.5 lg:text-[36px] lg:leading-[42.96px]">
            Setlist
          </h1>
        </FadeInUp>

        <SetlistView cardsData={cardsData} trackItemsByTeamId={trackItemsByTeamId} />
      </section>
    </main>
  );
}
