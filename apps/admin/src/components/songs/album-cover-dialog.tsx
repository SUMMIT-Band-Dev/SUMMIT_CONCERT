"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAlbumCoverCandidates, updateAlbumCover } from "@/lib/api/songs";
import type { ApiError } from "@/lib/api/errors";
import type { AlbumCoverCandidate, Song } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { checkAlbumCoverUrl, shrinkAlbumCoverUrl } from "@/lib/songs/album-cover-url";
import { cn } from "@/lib/utils";

interface AlbumCoverDialogProps {
  /** null이면 닫힘 */
  song: Song | null;
  teamId: string;
  onOpenChange: (open: boolean) => void;
}

type Mode = "candidates" | "manual";

/**
 * 앨범 커버 설정 대화상자 (PRD F010).
 *
 * 두 경로를 토글로 제공한다 — §10이 "하나라도 빠지면 API가 있어도 쓸 수 없다"고 남긴 요건이다.
 * 1. **후보에서 고르기**: `GET …/candidates`(최대 5개)를 눈으로 비교해 선택
 * 2. **URL 직접 입력**: 벤치마크에서 64곡 중 11곡이 후보로 해결되지 않았다(후보에 없음 10 + 0건 1).
 *    Apple Music에서 직접 찾은 주소를 붙여 넣는 경로가 없으면 그 곡들은 커버를 넣을 방법이 없다
 *
 * 후보 검색은 **버튼을 눌렀을 때만** 보낸다 — iTunes 호출이 프로세스 전체에서 분당 15회를
 * 공유하므로, 대화상자를 열고 닫는 것만으로 예산을 쓰면 안 된다.
 */
export function AlbumCoverDialog({ song, teamId, onOpenChange }: AlbumCoverDialogProps) {
  const queryClient = useQueryClient();
  const urlInputId = useId();
  const open = song !== null;

  const [mode, setMode] = useState<Mode>("candidates");
  const [candidates, setCandidates] = useState<AlbumCoverCandidate[] | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  // 다른 곡으로 열릴 때 이전 곡의 후보·선택이 남지 않게 한다.
  // (호출부가 key를 주지 않아도 되도록 여기서 처리한다 — 대화상자는 song이 null이 되며 닫힌다)
  useEffect(() => {
    if (!open) return;
    return () => {
      setCandidates(null);
      setSelectedUrl(null);
      setManualUrl("");
      setManualError(null);
      setMode("candidates");
    };
  }, [open]);

  const search = useMutation<AlbumCoverCandidate[], ApiError, void>({
    mutationFn: () => {
      if (!song) throw new Error("곡이 지정되지 않았습니다.");
      return fetchAlbumCoverCandidates(song.id);
    },
    onSuccess: (found) => {
      setCandidates(found);
      setSelectedUrl(found[0]?.artworkUrl ?? null);
    },
  });

  const apply = useMutation<Song, ApiError, string>({
    mutationFn: (url) => {
      if (!song) throw new Error("곡이 지정되지 않았습니다.");
      return updateAlbumCover(song.id, url);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamSongs(teamId) });
      onOpenChange(false);
    },
  });

  function handleApply() {
    if (apply.isPending) return;

    if (mode === "candidates") {
      if (selectedUrl) apply.mutate(selectedUrl);
      return;
    }

    // 직접 입력은 서버와 같은 규칙으로 먼저 걸러 "왜 거부됐는지"를 구체적으로 알려 준다.
    // 서버는 400에 공통 메시지만 주기 때문에 그대로 두면 관리자가 막힌다(§10 요건).
    const reason = checkAlbumCoverUrl(manualUrl);
    if (reason) {
      setManualError(reason);
      return;
    }
    setManualError(null);
    apply.mutate(manualUrl.trim());
  }

  const canApply = mode === "candidates" ? selectedUrl !== null : manualUrl.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>앨범 커버 설정</DialogTitle>
          <DialogDescription>
            {song ? `${song.title} — ${song.singer ?? "가수 미입력"}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === "candidates" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "candidates"}
            onClick={() => setMode("candidates")}
          >
            후보에서 고르기
          </Button>
          <Button
            type="button"
            variant={mode === "manual" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "manual"}
            onClick={() => setMode("manual")}
          >
            URL 직접 입력
          </Button>
        </div>

        {mode === "candidates" ? (
          <div className="grid gap-3">
            {/* §10 요건: 한국어로 검색해도 결과가 영문으로 나오는 것이 정상임을 알려 준다 */}
            <Alert>
              <Info aria-hidden="true" />
              <AlertDescription>
                검색은 미국 스토어 기준이라 곡명·아티스트가 <strong className="font-medium">영문으로 표기</strong>됩니다
                (예: 한로로 → HANRORO). 검색이 잘못된 것이 아닙니다.
              </AlertDescription>
            </Alert>

            <div>
              <Button type="button" variant="outline" size="sm" disabled={search.isPending} onClick={() => search.mutate()}>
                {search.isPending ? "검색 중…" : candidates === null ? "후보 검색" : "다시 검색"}
              </Button>
            </div>

            {search.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {search.error.messages.map((message, index) => (
                    <span key={index} className="block">
                      {message}
                    </span>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}

            {candidates !== null && candidates.length === 0 ? (
              <p className="text-body text-muted-foreground">
                검색은 됐지만 애플 카탈로그에서 이 곡을 찾지 못했습니다. &quot;URL 직접 입력&quot;으로 주소를 넣어 주세요.
              </p>
            ) : null}

            {candidates !== null && candidates.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {candidates.map((candidate) => {
                  const isSelected = candidate.artworkUrl === selectedUrl;
                  return (
                    <li key={candidate.artworkUrl}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedUrl(candidate.artworkUrl)}
                        className={cn(
                          "grid w-full gap-1 rounded-lg border p-1 text-left transition-colors hover:bg-muted",
                          isSelected && "border-primary ring-2 ring-ring/50",
                        )}
                      >
                        <img
                          src={shrinkAlbumCoverUrl(candidate.artworkUrl)}
                          alt={`${candidate.trackName} 앨범 커버 후보`}
                          className="aspect-square w-full rounded object-cover"
                        />
                        <span className="truncate text-caption font-medium" title={candidate.trackName}>
                          {candidate.trackName}
                        </span>
                        <span className="truncate text-caption text-muted-foreground" title={candidate.artistName}>
                          {candidate.artistName}
                        </span>
                        <span className="truncate text-caption text-muted-foreground" title={candidate.collectionName}>
                          {candidate.collectionName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor={urlInputId}>Apple Music 앨범 커버 주소</Label>
            <Input
              id={urlInputId}
              type="url"
              inputMode="url"
              placeholder="https://is1-ssl.mzstatic.com/image/thumb/…/600x600bb.jpg"
              value={manualUrl}
              aria-invalid={manualError ? true : undefined}
              onChange={(event) => {
                setManualUrl(event.target.value);
                setManualError(null);
              }}
            />
            <p className="text-caption text-muted-foreground">
              후보에 없는 곡은 Apple Music에서 찾은 커버 이미지 주소를 붙여 넣으세요. 주소 끝이 600x600bb.jpg 여야 합니다.
            </p>
            {manualError ? (
              <p role="alert" className="text-sm text-destructive">
                {manualError}
              </p>
            ) : null}
          </div>
        )}

        {apply.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {apply.error.messages.map((message, index) => (
                <span key={index} className="block">
                  {message}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" disabled={!canApply || apply.isPending} onClick={handleApply}>
            {apply.isPending ? "반영 중…" : "이 커버로 반영"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
