import type { TrackItem } from "@/types/setlist";

// 곡에 저장된 링크로 열어도 되는 YouTube 호스트. 그 밖의 주소는 검색 결과로 대체한다.
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

function openInNewTab(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 저장된 youtube_url을 검증한다. 파싱 실패, http(s) 이외 스킴, YouTube 이외 호스트는 null.
function parseYoutubeUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

// 곡에 바로 재생할 영상 링크가 있는지. 화면 표시(아이콘·접근성 문구)와 실제 동작이 어긋나지 않게 같은 검증을 쓴다.
export function hasPlayableVideo(track: TrackItem): boolean {
  return parseYoutubeUrl(track.youtubeUrl) !== null;
}

// "곡명 가수" 검색어. 백엔드 배치 검색(buildSearchQuery)과 같은 모양으로 맞춘다.
function buildSearchQuery(track: TrackItem): string {
  const normalize = (value: string) =>
    value.normalize("NFC").replace(/\s+/g, " ").trim();
  return [normalize(track.title), normalize(track.artist)]
    .filter(Boolean)
    .join(" ");
}

export function buildYoutubeSearchUrl(track: TrackItem): string {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", buildSearchQuery(track));
  return url.toString();
}

// 영상 링크가 있으면 그 영상(autoplay=1), 없거나 유효하지 않으면 YouTube 검색 결과 주소
export function resolveTrackVideoUrl(track: TrackItem): string {
  const videoUrl = parseYoutubeUrl(track.youtubeUrl);
  if (!videoUrl) return buildYoutubeSearchUrl(track);

  videoUrl.searchParams.set("autoplay", "1");
  return videoUrl.toString();
}

// 클릭 핸들러 안에서 동기적으로 새 탭을 연다(팝업 차단 방지).
export function openTrackVideo(track: TrackItem) {
  openInNewTab(resolveTrackVideoUrl(track));
}

// 스크린리더용 문구. 재생과 검색을 구분한다.
export function getTrackActionLabel(track: TrackItem): string {
  const target = `${track.title} – ${track.artist}`;
  return hasPlayableVideo(track)
    ? `${target} 영상 재생 (새 탭)`
    : `${target} 유튜브에서 검색 (새 탭)`;
}
