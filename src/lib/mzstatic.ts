// Apple Music/iTunes CDN(mzstatic.com) 앨범 커버 URL은 `.../{width}x{height}bb.jpg`로 끝나는 패턴을 가진다.
// 실제 표시 크기(56px)에 맞춰 원본(600x600) 대신 작은 크기를 요청해 다운로드 용량을 줄인다.
export function shrinkAlbumCoverUrl(url: string, size = 112) {
  return url.replace(/\/\d+x\d+bb\.jpg$/i, `/${size}x${size}bb.jpg`);
}
