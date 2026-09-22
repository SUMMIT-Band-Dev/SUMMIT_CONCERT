// YouTube Data API의 snippet.title/channelTitle은 HTML 엔티티로 이스케이프된 채로 온다
// (실측: "&quot;나는 AI..당신은 당연히 사람&quot;" — 2026-09-23 __verify__ 곡 검증 중 발견).
// 서버는 원본을 그대로 저장·전달한다 — apps/api/src/youtube/dto/recommendation-response.ts
// 주석이 "이스케이프는 렌더링 계층(7단계 관리자 UI)의 몫이다. 서버가 임의로 바꾸면 관리자가
// 실제 유튜브 제목과 다른 문자열을 보고 판단하게 된다"고 명시한다 — 이 화면이 표시 직전에
// 디코딩해야 하는 값이다.
//
// DOM(innerHTML/textarea 트릭)을 쓰지 않는다 — 순수 문자열 치환만으로 디코딩해
// dangerouslySetInnerHTML 금지 방침(page-states.tsx 등)과 같은 수준으로 안전하게 만든다.
// 디코딩 결과는 항상 텍스트 노드로만 렌더링한다(HTML로 해석하지 않는다).

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

const ENTITY_PATTERN = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g;

/**
 * 알려진 명명 엔티티(위 표)와 숫자 엔티티(`&#39;`, `&#x27;`)만 디코딩한다.
 * 모르는 엔티티는 원문 그대로 둔다 — 추측으로 바꾸지 않는다
 * (`YOUTUBE_THUMBNAIL_ALLOWED_HOSTS` 서버 주석과 같은 방침: "관측한 것만 처리한다").
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const codePoint = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
