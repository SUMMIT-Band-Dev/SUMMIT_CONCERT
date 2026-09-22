import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardImageThumbProps {
  /** 이미 절대 URL로 바꾼 값(`toDisplayUrl`). null이면 플레이스홀더를 그린다 */
  url: string | null;
  alt: string;
  /** 크기 클래스(예: "size-8"). 목록의 썸네일과 수정 화면의 미리보기가 크기만 다르다 */
  className?: string;
  iconClassName?: string;
}

/**
 * 팀 카드 이미지 썸네일. 값이 없거나 미리보기를 만들 수 없으면 플레이스홀더를 그린다.
 *
 * `next/image`를 쓰지 않는다 — next.config.ts에서 이미지 최적화를 꺼 두었고(`unoptimized`),
 * 여기서 보여 주는 것은 외부 공개 URL과 blob: 미리보기뿐이다.
 */
export function CardImageThumb({ url, alt, className, iconClassName }: CardImageThumbProps) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-md border bg-muted", className)}>
      {url ? (
        <img src={url} alt={alt} className="size-full object-cover" />
      ) : (
        <ImageOff aria-hidden="true" className={cn("text-muted-foreground", iconClassName)} />
      )}
    </div>
  );
}
