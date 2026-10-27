"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONCERT_IMAGE_SLOTS, getConcert, updateConcert, uploadConcertImage, type ConcertImageSlot } from "@/lib/api/concert-content";
import type { Concert } from "@/lib/api/types";
import { concertSchema, type ConcertFormValues } from "@/lib/concert-content/concert-schema";
import { PUBLIC_PAGE_PATHS } from "@/lib/concert-content/public-page-url";
import { queryKeys } from "@/lib/query-keys";
import { ConcertImageField } from "./concert-image-field";
import { SaveResultNotice } from "./save-result-notice";

const TEXT_FIELDS: Record<keyof ConcertFormValues, { label: string; type?: string; placeholder?: string }> = {
  titleKo: { label: "국문 제목" },
  titleEn: { label: "영문 제목" },
  subtitle: { label: "부제" },
  startDate: { label: "시작일", type: "date" },
  endDate: { label: "종료일", type: "date" },
  showTime: { label: "공연 시간", placeholder: "18:00 ~ 21:00" },
};
const IMAGE_FIELDS: Record<ConcertImageSlot, { label: string; field: "posterImageUrl" | "titleImageUrl" | "subtitleImageUrl" }> = {
  poster: { label: "포스터(메인 배경)", field: "posterImageUrl" },
  title: { label: "제목 이미지", field: "titleImageUrl" },
  subtitle: { label: "부제 이미지", field: "subtitleImageUrl" },
};

function ConcertForm({ concert }: { concert: Concert }) {
  const queryClient = useQueryClient();
  const form = useForm<ConcertFormValues>({
    resolver: zodResolver(concertSchema),
    defaultValues: { ...concert, subtitle: concert.subtitle ?? "" },
  });
  const mutation = useMutation({
    mutationFn: (values: ConcertFormValues) => updateConcert(values),
    onSuccess: async ({ data }) => {
      form.reset({ ...data, subtitle: data.subtitle ?? "" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.concert });
    },
  });
  const alt: Record<ConcertImageSlot, string> = {
    poster: "공연 포스터",
    title: concert.titleKo,
    subtitle: concert.subtitle ?? concert.titleKo,
  };
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>공연 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4">
            <fieldset disabled={mutation.isPending} className="grid gap-4 sm:grid-cols-2">
              {(Object.keys(TEXT_FIELDS) as (keyof ConcertFormValues)[]).map((name) => (
                <div key={name} className="grid gap-2">
                  <Label htmlFor={`concert-${name}`}>{TEXT_FIELDS[name].label}</Label>
                  <Input
                    id={`concert-${name}`}
                    type={TEXT_FIELDS[name].type}
                    placeholder={TEXT_FIELDS[name].placeholder}
                    {...form.register(name)}
                    aria-invalid={!!form.formState.errors[name]}
                    aria-describedby={form.formState.errors[name] ? `concert-${name}-error` : undefined}
                  />
                  {form.formState.errors[name] ? (
                    <p id={`concert-${name}-error`} role="alert" className="text-small text-destructive">
                      {form.formState.errors[name]?.message}
                    </p>
                  ) : null}
                </div>
              ))}
            </fieldset>
            {mutation.isError ? <ErrorState error={mutation.error} /> : null}
            {mutation.isSuccess ? (
              <SaveResultNotice revalidated={mutation.data.revalidated} publicPath={PUBLIC_PAGE_PATHS.concert} />
            ) : null}
            <Button type="submit" disabled={mutation.isPending} className="justify-self-start">
              {mutation.isPending ? "저장 중…" : "저장"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {CONCERT_IMAGE_SLOTS.map((slot) => (
        <ConcertImageField
          key={slot}
          label={IMAGE_FIELDS[slot].label}
          imageUrl={concert[IMAGE_FIELDS[slot].field]}
          alt={alt[slot]}
          upload={(file) => uploadConcertImage(slot, file)}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: queryKeys.concert })}
          publicPath={PUBLIC_PAGE_PATHS.concert}
        />
      ))}
    </div>
  );
}

export function ConcertPageClient() {
  const query = useQuery({ queryKey: queryKeys.concert, queryFn: ({ signal }) => getConcert({ signal }) });
  return (
    <>
      <PageHeader title="공연 기본 정보" description="공연 제목·일정과 메인 이미지를 관리합니다." />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ConcertForm concert={query.data} />
      )}
    </>
  );
}
