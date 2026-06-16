import { NextResponse } from "next/server";

const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
  };
};

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function includesAnyKeyword(target: string, keywords: string[]) {
  return keywords.some((keyword) => target.includes(keyword));
}

function calculateVideoScore(item: YouTubeSearchItem, title: string, artist: string) {
  const snippet = item.snippet ?? {};
  const normalizedTitle = normalizeText(snippet.title ?? "");
  const normalizedDescription = normalizeText(snippet.description ?? "");
  const normalizedChannel = normalizeText(snippet.channelTitle ?? "");
  const normalizedSongTitle = normalizeText(title);
  const normalizedArtist = normalizeText(artist);

  let score = 0;

  // 공식 MV 성격의 영상에 높은 가중치
  if (includesAnyKeyword(normalizedTitle, ["official mv", "official music video"])) score += 120;
  if (includesAnyKeyword(normalizedTitle, ["official"])) score += 35;
  if (includesAnyKeyword(normalizedTitle, [" mv ", "뮤직비디오", "music video"])) score += 30;
  if (includesAnyKeyword(normalizedDescription, ["official mv", "official music video"])) score += 40;
  if (includesAnyKeyword(normalizedChannel, ["official"])) score += 20;

  // 검색 대상 곡/아티스트와의 일치도
  if (normalizedSongTitle && normalizedTitle.includes(normalizedSongTitle)) score += 45;
  if (normalizedArtist && normalizedTitle.includes(normalizedArtist)) score += 20;
  if (normalizedArtist && normalizedDescription.includes(normalizedArtist)) score += 12;

  // 라이브/커버/직캠은 공식 MV 우선 요구에 맞춰 감점
  if (includesAnyKeyword(normalizedTitle, ["live", "cover", "fancam", "직캠", "라이브"])) score -= 30;

  return score;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const title = searchParams.get("title")?.trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";
  const shouldRedirect = searchParams.get("redirect") === "1";
  const apiKey = process.env.YOUTUBE_API_KEY?.trim() ?? "";
  const fallbackSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!apiKey) {
    if (shouldRedirect) {
      return NextResponse.redirect(fallbackSearchUrl);
    }
    return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });
  }

  const url = new URL(YOUTUBE_SEARCH_ENDPOINT);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    if (shouldRedirect) {
      return NextResponse.redirect(fallbackSearchUrl);
    }
    return NextResponse.json({ error: "YouTube API request failed" }, { status: response.status });
  }

  const data = (await response.json()) as { items?: YouTubeSearchItem[] };
  const items = data.items ?? [];

  const bestItem = items
    .map((item) => ({
      item,
      score: calculateVideoScore(item, title || query, artist || query),
    }))
    .sort((a, b) => b.score - a.score)[0]?.item;

  const videoId = bestItem?.id?.videoId ?? items[0]?.id?.videoId;
  if (!videoId) {
    if (shouldRedirect) {
      return NextResponse.redirect(fallbackSearchUrl);
    }
    return NextResponse.json({ error: "No video found" }, { status: 404 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  if (shouldRedirect) {
    return NextResponse.redirect(`${videoUrl}&autoplay=1`);
  }

  return NextResponse.json({ url: videoUrl });
}
