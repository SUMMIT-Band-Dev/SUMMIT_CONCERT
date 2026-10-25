import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildPublicPageUrl } from "@/lib/concert-content/public-page-url";

// Next.js가 클라이언트 번들에 값을 넣도록 문자 그대로 읽는다.
const PUBLIC_SITE_ORIGIN = process.env.NEXT_PUBLIC_PUBLIC_SITE_ORIGIN;

export function SaveResultNotice({ revalidated, publicPath }: { revalidated: boolean; publicPath: string }) {
  const url = buildPublicPageUrl(publicPath, PUBLIC_SITE_ORIGIN);
  return (
    <Alert
      role="status"
      className={revalidated ? undefined : "border-warning bg-badge-warning-bg text-badge-warning-fg"}
    >
      <AlertDescription>
        <p>{revalidated ? "저장했습니다." : "저장됨 — 사이트 반영이 지연될 수 있습니다(최대 1시간)."}</p>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            공개 페이지에서 확인
          </a>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
