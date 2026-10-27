"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ErrorState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CardImageThumb } from "@/components/teams/card-image-thumb";
import type { SaveResult } from "@/lib/api/types";
import { CARD_IMAGE_ACCEPT } from "@/lib/teams/card-image";
import { checkConcertImageFile } from "@/lib/concert-content/concert-image";
import { SaveResultNotice } from "./save-result-notice";

interface ConcertImageFieldProps {
  label: string;
  imageUrl: string | null;
  alt: string;
  upload: (file: File) => Promise<SaveResult<unknown>>;
  onUploaded: () => void | Promise<unknown>;
  publicPath: string;
}

export function ConcertImageField({ label, imageUrl, alt, upload, onUploaded, publicPath }: ConcertImageFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const mutation = useMutation({
    mutationFn: upload,
    onSuccess: async () => {
      clearSelection();
      await onUploaded();
    },
  });

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  useEffect(
    () => () => {
      selectionVersion.current += 1;
    },
    [],
  );

  function clearSelection() {
    selectionVersion.current += 1;
    setFile(null);
    setPreviewUrl(null);
    setLocalError(null);
    setChecking(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    clearSelection();
    mutation.reset();
    if (!selected) return;
    const version = selectionVersion.current;
    setChecking(true);
    const { error } = await checkConcertImageFile(selected);
    if (version !== selectionVersion.current) return;
    setChecking(false);
    if (error) {
      setLocalError(error);
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex flex-wrap items-start gap-3">
        <CardImageThumb url={previewUrl ?? imageUrl} alt={alt} className="size-28 shrink-0" iconClassName="size-6" />
        <div className="grid min-w-0 flex-1 gap-2">
          {!imageUrl && !previewUrl ? <p className="text-small text-muted-foreground">등록된 이미지 없음</p> : null}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={CARD_IMAGE_ACCEPT}
            disabled={mutation.isPending}
            onChange={handleSelect}
            className="block w-full text-small"
          />
          <p className="text-caption text-muted-foreground">
            JPEG · PNG · WebP, 2MB 이하. 이미지 업로드는 텍스트 저장과 별개로 즉시 반영됩니다.
          </p>
          {file ? <p className="break-all text-small">선택함: {file.name}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!file || checking || mutation.isPending}
              onClick={() => file && mutation.mutate(file)}
            >
              {mutation.isPending ? "업로드 중…" : "이미지 업로드"}
            </Button>
            {file ? (
              <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={clearSelection}>
                선택 취소
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {localError ? (
        <p role="alert" className="text-small text-destructive">
          {localError}
        </p>
      ) : null}
      {mutation.isError ? <ErrorState error={mutation.error} /> : null}
      {mutation.isSuccess ? <SaveResultNotice revalidated={mutation.data.revalidated} publicPath={publicPath} /> : null}
    </div>
  );
}
