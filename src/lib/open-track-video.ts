import type { TrackItem } from "@/types/setlist";

function openInNewTab(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function openTrackVideo(track: TrackItem) {
  if (track.youtubeUrl) {
    const url = new URL(track.youtubeUrl);
    url.searchParams.set("autoplay", "1");
    openInNewTab(url.toString());
    return;
  }

  // 팝업 차단 방지: 클릭 이벤트 내에서 즉시 새 창 열기
  const win = window.open("", "_blank");

  const query = `${track.title} ${track.artist}`.trim();
  const params = new URLSearchParams({
    query,
    title: track.title,
    artist: track.artist,
  });

  fetch(`/api/youtube/top-video?${params.toString()}`)
    .then((r) => r.json())
    .then((data: { url?: string }) => {
      const dest = data.url
        ? (() => {
            const u = new URL(data.url);
            u.searchParams.set("autoplay", "1");
            return u.toString();
          })()
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      if (win) {
        win.location.href = dest;
      } else {
        openInNewTab(dest);
      }
    })
    .catch(() => {
      const fallback = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      if (win) {
        win.location.href = fallback;
      } else {
        openInNewTab(fallback);
      }
    });
}
