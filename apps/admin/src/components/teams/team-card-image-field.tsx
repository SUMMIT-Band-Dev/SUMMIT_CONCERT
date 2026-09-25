"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadTeamCardImage } from "@/lib/api/teams";
import type { ApiError } from "@/lib/api/errors";
import type { Team } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { CARD_IMAGE_ACCEPT, checkCardImageFile, toDisplayUrl } from "@/lib/teams/card-image";
import { CardImageThumb } from "./card-image-thumb";

/**
 * 업로드 요청 타임아웃. 기본 15초보다 길게 잡는다 —
 * 1MB 전송 + 서버의 저장소 왕복(최대 10초)이 겹치면 기본값으로는 느린 회선에서 잘린다.
 */
const UPLOAD_TIMEOUT_MS = 30_000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(2)}MB`;
}

/**
 * 팀 카드뉴스 이미지 업로드 필드 (PRD F007 / work02-7c-2b).
 *
 * **팀명·일자 저장(PATCH)과 별개의 동작이다.** 서버 엔드포인트가 따로고(PUT .../card-image),
 * 업로드가 곧 저장소 쓰기라 되돌릴 수 없다. 그래서 파일을 고르면 바로 올리지 않고
 * 미리보기를 보여 준 뒤 **버튼을 눌러야** 올라간다(실수로 프로덕션에 쓰지 않도록).
 *
 * 호출부는 `key={team.id}`로 렌더링한다 — 다른 팀으로 대화상자가 다시 열릴 때 이펙트로 상태를
 * 되돌리는 대신 React가 새로 마운트하게 해서 이전 팀의 선택·미리보기·오류가 남지 않는다.
 */
export function TeamCardImageField({ team }: { team: Team }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // 업로드 성공 뒤에도 대화상자가 열린 채로 남으므로, 목록에서 받은 team prop이 아니라
  // 여기서 최신 URL을 들고 있는다(부모의 team은 열었을 때의 스냅샷이다)
  const [currentUrl, setCurrentUrl] = useState<string | null>(team.cardImageUrl);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation<Team, ApiError, File>({
    mutationFn: (selected) => uploadTeamCardImage(team.id, selected, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    onSuccess: (updated) => {
      setCurrentUrl(updated.cardImageUrl);
      clearSelection();
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams });
    },
  });

  // blob: URL은 명시적으로 해제하지 않으면 탭이 닫힐 때까지 남는다
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function clearSelection() {
    setFile(null);
    setPreviewUrl(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setLocalError(null);
    mutation.reset();

    if (!selected) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    // 서버와 같은 규칙으로 먼저 거른다(왕복 절약). 최종 판별은 서버가 다시 한다
    const { error } = await checkCardImageFile(selected);
    if (error) {
      setLocalError(error);
      setFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  const resolvedCurrentUrl = toDisplayUrl(currentUrl);
  // 값은 있는데 절대 URL을 못 만든 경우(상대경로 + 공개 사이트 오리진 미설정)
  const previewUnavailable = currentUrl !== null && resolvedCurrentUrl === null;
  const shownUrl = previewUrl ?? resolvedCurrentUrl;

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>카드뉴스 이미지</Label>

      <div className="flex items-start gap-3">
        <CardImageThumb
          url={shownUrl}
          alt={`${team.teamName} 카드뉴스 이미지`}
          className="size-24 shrink-0 rounded-lg"
          iconClassName="size-6"
        />

        <div className="grid min-w-0 flex-1 gap-1.5">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={CARD_IMAGE_ACCEPT}
            onChange={handleSelect}
            disabled={mutation.isPending}
            className="block w-full text-small file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-2.5 file:py-1 file:text-small file:font-medium file:text-foreground hover:file:bg-muted disabled:opacity-50"
          />

          <p className="text-caption text-muted-foreground">
            JPEG · PNG · WebP, 1MB 이하. 업로드는 아래 저장과 별개로 <strong className="font-medium">즉시 반영</strong>됩니다.
          </p>

          {file ? (
            <p className="truncate text-caption text-muted-foreground">
              선택함: {file.name} ({formatBytes(file.size)})
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!file || mutation.isPending}
              onClick={() => file && mutation.mutate(file)}
            >
              {mutation.isPending ? "업로드 중…" : "이미지 업로드"}
            </Button>
            {file ? (
              <Button type="button" variant="ghost" size="sm" disabled={mutation.isPending} onClick={clearSelection}>
                선택 취소
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {previewUnavailable ? (
        <p className="text-caption text-muted-foreground">
          기존 이미지는 공개 사이트 기준 상대경로라 미리보기를 만들 수 없습니다(NEXT_PUBLIC_PUBLIC_SITE_ORIGIN 미설정).
        </p>
      ) : null}

      {localError ? (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      ) : null}

      {mutation.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {mutation.error.messages.map((message, index) => (
              <span key={index} className="block">
                {message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      {mutation.isSuccess ? <p className="text-caption text-muted-foreground">이미지를 올렸습니다.</p> : null}
    </div>
  );
}
