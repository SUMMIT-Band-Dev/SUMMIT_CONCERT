import { hasPlayableVideo } from "@/lib/open-track-video";
import type { TrackItem } from "@/types/setlist";

// 곡 행 오른쪽의 원형 표시. 영상이 있으면 ▶, 없으면 유튜브 검색 결과로 이동함을 돋보기로 알린다.
export default function TrackActionIndicator({ track }: { track: TrackItem }) {
  const isPlayable = hasPlayableVideo(track);

  return (
    <div
      title={isPlayable ? undefined : "유튜브에서 검색"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/35 text-[12px] text-white/85"
    >
      {isPlayable ? (
        "▶"
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      )}
    </div>
  );
}
