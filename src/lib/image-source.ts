// DB에 저장된 이미지 경로를 화면에서 쓸 수 있는 형태로 정규화한다.
// - 역슬래시를 슬래시로 바꾸고, 빌드 산출물 접두사(`public/`, `dist/`)를 제거한다.
// - `http://`·`https://`로 시작하는 값은 그대로 둔다(Supabase Storage, 외부 CDN).
// - 그 외에는 `/`로 시작하는 사이트 내부 경로로 맞춘다.
// - 문자열이 아니거나 비어 있으면 빈 문자열을 돌려준다(호출하는 쪽이 "이미지 없음"으로 판단).
export function normalizeImageSource(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replaceAll("\\", "/");
  if (!trimmed) return "";
  const withoutAssetPrefix = trimmed.replace(/^(public|dist)\//i, "");
  if (
    withoutAssetPrefix.startsWith("http://") ||
    withoutAssetPrefix.startsWith("https://")
  ) {
    return withoutAssetPrefix;
  }
  return withoutAssetPrefix.startsWith("/")
    ? withoutAssetPrefix
    : `/${withoutAssetPrefix}`;
}
