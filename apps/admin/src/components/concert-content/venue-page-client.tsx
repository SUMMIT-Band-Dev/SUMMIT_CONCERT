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
import { geocodeAddress, getVenue, updateVenue } from "@/lib/api/concert-content";
import type { Venue } from "@/lib/api/types";
import { roundCoordinate, toVenueFormValues, toVenuePayload, venueSchema, type VenueFormValues } from "@/lib/concert-content/venue-schema";
import { PUBLIC_PAGE_PATHS } from "@/lib/concert-content/public-page-url";
import { queryKeys } from "@/lib/query-keys";
import { SaveResultNotice } from "./save-result-notice";
import { VenueMapPicker } from "./venue-map-picker";

const BASIC_FIELDS = {
  name: { label: "공연장 이름", placeholder: "" },
  address: { label: "주소", placeholder: "도로명 주소" },
  addressDetail: { label: "상세 주소", placeholder: "예: 지하 1층" },
};
const COORDINATE_FIELDS = { latitude: "위도", longitude: "경도" } as const;
const LINK_FIELDS = {
  websiteUrl: { label: "공연장 홈페이지", description: "Stage Info 카드가 연결하는 주소" },
  naverMapUrl: {
    label: "네이버 지도 장소 링크",
    description: "네이버 지도에서 장소를 검색해 '공유' 링크를 붙여넣어 주세요. 주소에서 자동으로 만들지 않습니다.",
  },
};

function VenueForm({ venue }: { venue: Venue }) {
  const queryClient = useQueryClient();
  const form = useForm<VenueFormValues>({ resolver: zodResolver(venueSchema), defaultValues: toVenueFormValues(venue) });
  const [latitude, longitude, address] = useWatch({ control: form.control, name: ["latitude", "longitude", "address"] });
  const geocode = useMutation({
    mutationFn: (value: string) => geocodeAddress(value),
    onSuccess: (data) => setCoordinates(data.latitude, data.longitude),
  });
  const save = useMutation({
    mutationFn: (values: VenueFormValues) => updateVenue(toVenuePayload(values)),
    onSuccess: async ({ data }) => {
      form.reset(toVenueFormValues(data));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.venue }),
        queryClient.invalidateQueries({ queryKey: queryKeys.concert }),
      ]);
    },
  });

  function setCoordinates(lat: number, lng: number) {
    form.setValue("latitude", roundCoordinate(lat), { shouldDirty: true, shouldValidate: true });
    form.setValue("longitude", roundCoordinate(lng), { shouldDirty: true, shouldValidate: true });
  }
  async function findLocation() {
    geocode.reset();
    const value = form.getValues("address").trim();
    if (!value || value.length > 200) {
      await form.trigger("address");
      return;
    }
    form.clearErrors("address");
    geocode.mutate(value);
  }
  function fieldError(name: keyof VenueFormValues) {
    const error = form.formState.errors[name];
    return error ? (
      <p id={`venue-${name}-error`} role="alert" className="text-small text-destructive">
        {error.message}
      </p>
    ) : null;
  }

  return (
    <form noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))} className="grid gap-6">
      <fieldset disabled={save.isPending || geocode.isPending} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(Object.keys(BASIC_FIELDS) as (keyof typeof BASIC_FIELDS)[]).map((name) => (
              <div key={name} className="grid gap-2">
                <Label htmlFor={`venue-${name}`}>{BASIC_FIELDS[name].label}</Label>
                <Input
                  id={`venue-${name}`}
                  {...form.register(name)}
                  placeholder={BASIC_FIELDS[name].placeholder}
                  aria-invalid={!!form.formState.errors[name]}
                  aria-describedby={form.formState.errors[name] ? `venue-${name}-error` : undefined}
                />
                {fieldError(name)}
                {name === "address" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={geocode.isPending || save.isPending}
                      onClick={() => void findLocation()}
                    >
                      {geocode.isPending ? "위치 찾는 중…" : "위치 찾기"}
                    </Button>
                    <p className="text-small text-muted-foreground">위치 찾기는 저장하지 않습니다.</p>
                  </div>
                ) : null}
              </div>
            ))}
            {geocode.isError ? <ErrorState error={geocode.error} /> : null}
            {geocode.isSuccess ? (
              <div className="grid gap-2" role="status">
                <p className="text-small">검색된 위치: {geocode.data.roadAddress} — 지도에서 위치를 확인한 뒤 저장해 주세요.</p>
                {geocode.data.roadAddress !== address ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={() => form.setValue("address", geocode.data.roadAddress, { shouldDirty: true, shouldValidate: true })}
                  >
                    검색된 도로명 주소로 바꾸기
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>지도 위치</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <VenueMapPicker latitude={latitude} longitude={longitude} onChange={setCoordinates} />
            <div className="grid gap-4 sm:grid-cols-2">
              {(Object.keys(COORDINATE_FIELDS) as (keyof typeof COORDINATE_FIELDS)[]).map((name) => (
                <div key={name} className="grid gap-2">
                  <Label htmlFor={`venue-${name}`}>{COORDINATE_FIELDS[name]}</Label>
                  <Input
                    id={`venue-${name}`}
                    type="number"
                    step="0.000001"
                    {...form.register(name, { valueAsNumber: true })}
                    aria-invalid={!!form.formState.errors[name]}
                    aria-describedby={form.formState.errors[name] ? `venue-${name}-error` : undefined}
                  />
                  {fieldError(name)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>외부 링크</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(Object.keys(LINK_FIELDS) as (keyof typeof LINK_FIELDS)[]).map((name) => (
              <div key={name} className="grid gap-2">
                <Label htmlFor={`venue-${name}`}>{LINK_FIELDS[name].label}</Label>
                <Input
                  id={`venue-${name}`}
                  {...form.register(name)}
                  aria-invalid={!!form.formState.errors[name]}
                  aria-describedby={`venue-${name}-description${form.formState.errors[name] ? ` venue-${name}-error` : ""}`}
                />
                <p id={`venue-${name}-description`} className="text-small text-muted-foreground">
                  {LINK_FIELDS[name].description}
                </p>
                {fieldError(name)}
              </div>
            ))}
          </CardContent>
        </Card>
      </fieldset>
      {save.isError ? <ErrorState error={save.error} /> : null}
      {save.isSuccess ? <SaveResultNotice revalidated={save.data.revalidated} publicPath={PUBLIC_PAGE_PATHS.venue} /> : null}
      <Button type="submit" disabled={save.isPending || geocode.isPending} className="justify-self-start">
        {save.isPending ? "저장 중…" : "저장"}
      </Button>
    </form>
  );
}

export function VenuePageClient() {
  const query = useQuery({ queryKey: queryKeys.venue, queryFn: ({ signal }) => getVenue({ signal }) });
  return (
    <>
      <PageHeader title="공연장 정보" description="공연장 이름·주소와 지도 위치, 외부 링크를 관리합니다." />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <VenueForm venue={query.data} />
      )}
    </>
  );
}
