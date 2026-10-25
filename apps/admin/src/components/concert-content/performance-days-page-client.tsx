"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listPerformanceDays, updatePerformanceDay, uploadTimetableImage } from "@/lib/api/concert-content";
import type { PerformanceDay } from "@/lib/api/types";
import {
  performanceDaySchema,
  toPerformanceDayFormValues,
  toPerformanceDayPayload,
  type PerformanceDayFormValues,
} from "@/lib/concert-content/performance-day-schema";
import { PUBLIC_PAGE_PATHS } from "@/lib/concert-content/public-page-url";
import { queryKeys } from "@/lib/query-keys";
import { ConcertImageField } from "./concert-image-field";
import { SaveResultNotice } from "./save-result-notice";

const FIELDS = {
  dayLabel: { label: "일차 라벨", placeholder: "Day 1" },
  dateLabel: { label: "날짜 라벨", placeholder: "6.25 (목) 18:00" },
  bookingUrl: { label: "예매 링크", placeholder: "https://forms.gle/…" },
};

function PerformanceDayCard({ day }: { day: PerformanceDay }) {
  const queryClient = useQueryClient();
  const form = useForm<PerformanceDayFormValues>({
    resolver: zodResolver(performanceDaySchema),
    defaultValues: toPerformanceDayFormValues(day),
  });
  const mode = useWatch({ control: form.control, name: "lineupMode" });
  const mutation = useMutation({
    mutationFn: (values: PerformanceDayFormValues) => updatePerformanceDay(day.dayKey, toPerformanceDayPayload(values)),
    onSuccess: async ({ data }) => {
      form.reset(toPerformanceDayFormValues(data));
      await queryClient.invalidateQueries({ queryKey: queryKeys.performanceDays });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {day.dayLabel} ({day.dayKey})
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4">
          <fieldset disabled={mutation.isPending} className="grid gap-4">
            {(Object.keys(FIELDS) as (keyof typeof FIELDS)[]).map((name) => (
              <div key={name} className="grid gap-2">
                <Label htmlFor={`${day.dayKey}-${name}`}>{FIELDS[name].label}</Label>
                <Input
                  id={`${day.dayKey}-${name}`}
                  placeholder={FIELDS[name].placeholder}
                  {...form.register(name)}
                  aria-invalid={!!form.formState.errors[name]}
                  aria-describedby={form.formState.errors[name] ? `${day.dayKey}-${name}-error` : undefined}
                />
                {form.formState.errors[name] ? (
                  <p id={`${day.dayKey}-${name}-error`} role="alert" className="text-small text-destructive">
                    {form.formState.errors[name]?.message}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="grid gap-2">
              <Label htmlFor={`${day.dayKey}-lineup`}>출연진</Label>
              {mode === "auto" ? (
                <>
                  <p id={`${day.dayKey}-lineup`} className="whitespace-pre-wrap text-body">
                    {day.autoLineup.join(", ") || "팀 관리에 이 일차 팀이 없습니다."}
                  </p>
                  <p className="text-small text-muted-foreground">팀 관리 순서대로 자동 표시됩니다</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={() => {
                      if (!form.getValues("lineupText").trim()) form.setValue("lineupText", day.autoLineup.join(", "));
                      form.setValue("lineupMode", "manual", { shouldDirty: true, shouldValidate: true });
                    }}
                  >
                    직접 수정
                  </Button>
                </>
              ) : (
                <>
                  <Textarea
                    id={`${day.dayKey}-lineup`}
                    {...form.register("lineupText")}
                    aria-invalid={!!form.formState.errors.lineupText}
                    aria-describedby={form.formState.errors.lineupText ? `${day.dayKey}-lineup-error` : undefined}
                  />
                  {form.formState.errors.lineupText ? (
                    <p id={`${day.dayKey}-lineup-error`} role="alert" className="text-small text-destructive">
                      {form.formState.errors.lineupText.message}
                    </p>
                  ) : null}
                  <p className="text-small text-warning">직접 수정 중에는 팀 관리 변경이 자동 반영되지 않습니다.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={() => form.setValue("lineupMode", "auto", { shouldDirty: true, shouldValidate: true })}
                  >
                    자동으로 되돌리기
                  </Button>
                </>
              )}
              <p className="text-small text-muted-foreground">자동/직접 수정 전환은 저장 버튼을 눌러야 반영됩니다.</p>
            </div>
          </fieldset>
          {mutation.isError ? <ErrorState error={mutation.error} /> : null}
          {mutation.isSuccess ? (
            <SaveResultNotice revalidated={mutation.data.revalidated} publicPath={PUBLIC_PAGE_PATHS.performanceDays} />
          ) : null}
          <Button type="submit" disabled={mutation.isPending} className="justify-self-start">
            {mutation.isPending ? "저장 중…" : "저장"}
          </Button>
        </form>
        <ConcertImageField
          label="타임 테이블"
          imageUrl={day.timetableImageUrl}
          alt={`${day.dayLabel} 타임 테이블`}
          upload={(file) => uploadTimetableImage(day.dayKey, file)}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: queryKeys.performanceDays })}
          publicPath={PUBLIC_PAGE_PATHS.performanceDays}
        />
      </CardContent>
    </Card>
  );
}

export function PerformanceDaysPageClient() {
  const query = useQuery({ queryKey: queryKeys.performanceDays, queryFn: ({ signal }) => listPerformanceDays({ signal }) });
  return (
    <>
      <PageHeader title="일차별 공연" description="일차별 일정·예매 링크·출연진과 타임 테이블을 관리합니다." />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-6">
          {query.data.map((day) => (
            <PerformanceDayCard key={day.dayKey} day={day} />
          ))}
        </div>
      )}
    </>
  );
}
