export function SquareGrayArtwork() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[8px] bg-[#d9d9d9]">
      <div className="h-[34%] w-[34%] rounded-full bg-[#bcbcbc]" />
    </div>
  );
}

export function DummyPosterArtwork() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[8px] bg-[#5a5a5a] text-center">
      <div className="h-[24%] w-[24%] rounded-full bg-[#777777]" />
      <p className="mt-4 text-[12px] font-medium text-white/80">임시 포스터</p>
    </div>
  );
}
