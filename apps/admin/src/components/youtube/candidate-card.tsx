import { ExternalLink } from "lucide-react";
import type { YoutubeRecommendationCandidate } from "@/lib/api/types";
import { decodeHtmlEntities } from "@/lib/youtube/decode-html-entities";
import { cn } from "@/lib/utils";

interface CandidateCardProps {
  candidate: YoutubeRecommendationCandidate;
  selected: boolean;
  onSelect: () => void;
}

/**
 * 추천 후보 카드 (PRD F012). 썸네일·제목·채널 전부 외부(YouTube)에서 온 문자열이라
 * **텍스트로만 렌더링**한다(dangerouslySetInnerHTML 금지 — page-states.tsx와 같은 방침).
 *
 * `score`(참고값)는 표시하지 않는다 — 정렬에 쓰이지 않아 보여 주면 관리자를 오도한다
 * (`RecommendationCandidateResponse` 서버 주석 참조).
 *
 * **제목·채널명은 HTML 엔티티로 이스케이프된 채로 온다**(실측: `__verify__` 곡 검증 중
 * `&quot;`·`&#39;` 확인). 서버 주석이 "이스케이프는 렌더링 계층의 몫"이라고 명시해
 * `decodeHtmlEntities`로 디코딩한 뒤 텍스트로만 렌더링한다(HTML로 해석하지 않는다).
 *
 * "유튜브에서 열기"를 따로 두는 이유: 썸네일·제목만으로는 커버 영상인지 원곡인지
 * 확신할 수 없어 실제 재생 확인 경로가 필요하다.
 */
export function CandidateCard({ candidate, selected, onSelect }: CandidateCardProps) {
  const watchUrl = `https://www.youtube.com/watch?v=${candidate.videoId}`;
  const title = decodeHtmlEntities(candidate.title);
  const channelTitle = decodeHtmlEntities(candidate.channelTitle);

  return (
    <div
      className={cn(
        "grid gap-1.5 rounded-lg border p-2 transition-colors",
        selected ? "border-primary ring-2 ring-ring/50" : "hover:bg-muted",
      )}
    >
      <button type="button" aria-pressed={selected} onClick={onSelect} className="grid gap-1.5 text-left">
        <div className="relative aspect-video w-full overflow-hidden rounded bg-muted">
          <img src={candidate.thumbnailUrl} alt="" className="size-full object-cover" />
          <span className="absolute top-1 left-1 rounded bg-overlay px-1.5 py-0.5 text-caption font-medium text-primary-foreground">
            {candidate.rank}위
          </span>
        </div>
        <span className="line-clamp-2 text-caption font-medium" title={title}>
          {title}
        </span>
        <span className="truncate text-caption text-muted-foreground" title={channelTitle}>
          {channelTitle}
        </span>
      </button>
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-caption text-primary hover:underline"
      >
        <ExternalLink aria-hidden="true" className="size-3" />
        유튜브에서 열기
      </a>
    </div>
  );
}
