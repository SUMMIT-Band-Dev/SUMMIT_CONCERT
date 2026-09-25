"use client";

import { useState } from "react";
import Image from "next/image";
import { SquareGrayArtwork } from "@/components/ui/artwork-placeholders";

type TrackCoverImageProps = {
  src: string;
  alt: string;
  size: number;
};

export default function TrackCoverImage({ src, alt, size }: TrackCoverImageProps) {
  const [hasLoadError, setHasLoadError] = useState(false);

  if (hasLoadError) {
    return <SquareGrayArtwork />;
  }

  // 외부 이미지(음원 사이트 URL)는 Next image optimizer를 거치지 않고 직접 렌더링해 깨짐을 방지한다.
  if (/^https?:\/\//i.test(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        unoptimized
        onError={() => setHasLoadError(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="h-full w-full object-cover"
      onError={() => setHasLoadError(true)}
    />
  );
}
