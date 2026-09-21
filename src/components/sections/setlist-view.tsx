"use client";

import { useCallback, useMemo, useState } from "react";
import FadeInUp from "@/components/common/fade-in-up";
import SetlistDetailModal from "@/components/ui/setlist-detail-modal";
import SetlistLineupSections from "@/components/sections/setlist-lineup-sections";
import { getDayLabel, getSortedDays } from "@/lib/line-up";
import { openTrackVideo } from "@/lib/open-track-video";
import type { DayType, SetlistCard, TrackItem } from "@/types/setlist";

const trackListByDay: Record<DayType, TrackItem[]> = {
  1: [
    { id: 101, title: "Twilight", artist: "SUMMIT Band", coverShape: "square" },
    {
      id: 102,
      title: "Sunset Sky",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    { id: 103, title: "Dreaming", artist: "SUMMIT Band", coverShape: "square" },
    {
      id: 104,
      title: "Blue Hour",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 105,
      title: "After Party",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    { id: 106, title: "Encore", artist: "SUMMIT Band", coverShape: "square" },
  ],
  2: [
    {
      id: 201,
      title: "Night Drive",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 202,
      title: "Moonlight",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 203,
      title: "Afterglow",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    {
      id: 204,
      title: "Last Song",
      artist: "SUMMIT Band",
      coverShape: "square",
    },
    { id: 205, title: "Midnight", artist: "SUMMIT Band", coverShape: "square" },
    { id: 206, title: "Finale", artist: "SUMMIT Band", coverShape: "square" },
  ],
};

export default function SetlistView({
  cardsData,
  trackItemsByTeamId,
}: {
  cardsData: SetlistCard[];
  trackItemsByTeamId: Record<number, TrackItem[]>;
}) {
  const [pickedDay, setPickedDay] = useState<DayType | null>(null);
  const [selectedCard, setSelectedCard] = useState<SetlistCard | null>(null);

  // 일차 탭은 카드 데이터에 있는 일차만, 숫자순으로 만든다. 고른 일차가 없어졌으면 첫 일차를 쓴다.
  const days = useMemo(
    () => getSortedDays(cardsData.map((card) => card.day)),
    [cardsData],
  );
  const selectedDay =
    pickedDay !== null && days.includes(pickedDay) ? pickedDay : (days[0] ?? 1);

  const cards = useMemo(
    () => cardsData.filter((card) => card.day === selectedDay),
    [cardsData, selectedDay],
  );

  const matchedTrackItems = selectedCard
    ? trackItemsByTeamId[selectedCard.id]
    : undefined;
  const trackItems = matchedTrackItems?.length
    ? matchedTrackItems
    : (trackListByDay[selectedDay] ?? []);

  const handleSelectCard = useCallback((card: SetlistCard) => {
    setSelectedCard(card);
  }, []);
  const handleCloseCard = useCallback(() => {
    setSelectedCard(null);
  }, []);

  return (
    <>
      <FadeInUp delay={0.1}>
        <div className="mt-4 flex items-center gap-5 md:mt-6 md:gap-8">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setPickedDay(day)}
              className={`text-[20px] font-semibold leading-[23.87px] transition-colors md:text-[24px] md:leading-[28.64px] lg:text-[28px] lg:leading-[33.41px] ${
                selectedDay === day ? "text-white" : "text-[#ababab]"
              }`}
            >
              {getDayLabel(day)}
            </button>
          ))}
        </div>
      </FadeInUp>

      <SetlistLineupSections
        cards={cards}
        selectedDay={selectedDay}
        onSelectCard={handleSelectCard}
      />

      <SetlistDetailModal
        selectedCard={selectedCard}
        trackItems={trackItems}
        onClose={handleCloseCard}
        onTrackClick={openTrackVideo}
      />
    </>
  );
}
