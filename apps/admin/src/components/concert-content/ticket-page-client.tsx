"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_IMAGE_SIDES, getTicket, updateTicket, uploadTicketImage, type TicketImageSide } from "@/lib/api/concert-content";
import type { Ticket } from "@/lib/api/types";
import { ticketSchema, type TicketFormValues } from "@/lib/concert-content/ticket-schema";
import { PUBLIC_PAGE_PATHS } from "@/lib/concert-content/public-page-url";
import { queryKeys } from "@/lib/query-keys";
import { ConcertImageField } from "./concert-image-field";
import { InfoSectionsEditor } from "./info-sections-editor";
import { SaveResultNotice } from "./save-result-notice";

const IMAGES: Record<TicketImageSide, { label: string; field: "frontImageUrl" | "backImageUrl" }> = {
  front: { label: "티켓 앞면", field: "frontImageUrl" },
  back: { label: "티켓 뒷면", field: "backImageUrl" },
};

function TicketForm({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient();
  const form = useForm<TicketFormValues>({ resolver: zodResolver(ticketSchema), defaultValues: { description: ticket.description ?? "" } });
  const mutation = useMutation({
    mutationFn: (values: TicketFormValues) => updateTicket(values),
    onSuccess: async ({ data }) => {
      form.reset({ description: data.description ?? "" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticket });
    },
  });
  return (
    <div className="grid gap-6">
      {TICKET_IMAGE_SIDES.map((side) => (
        <ConcertImageField
          key={side}
          label={IMAGES[side].label}
          imageUrl={ticket[IMAGES[side].field]}
          alt={IMAGES[side].label}
          upload={(file) => uploadTicketImage(side, file)}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: queryKeys.ticket })}
          publicPath={PUBLIC_PAGE_PATHS.ticket}
        />
      ))}
      <Card>
        <CardHeader>
          <CardTitle>티켓 설명</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4">
            <Label htmlFor="ticket-description">티켓 설명</Label>
            <Textarea
              id="ticket-description"
              {...form.register("description")}
              disabled={mutation.isPending}
              aria-invalid={!!form.formState.errors.description}
              aria-describedby={form.formState.errors.description ? "ticket-description-error" : undefined}
            />
            {form.formState.errors.description ? (
              <p id="ticket-description-error" role="alert" className="text-small text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
            {mutation.isError ? <ErrorState error={mutation.error} /> : null}
            {mutation.isSuccess ? <SaveResultNotice revalidated={mutation.data.revalidated} publicPath={PUBLIC_PAGE_PATHS.ticket} /> : null}
            <Button type="submit" disabled={mutation.isPending} className="justify-self-start">
              {mutation.isPending ? "저장 중…" : "저장"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function TicketPageClient() {
  const query = useQuery({ queryKey: queryKeys.ticket, queryFn: ({ signal }) => getTicket({ signal }) });
  return (
    <>
      <PageHeader title="티켓 안내" description="티켓 이미지·설명과 요금 안내를 관리합니다." />
      <div className="grid gap-6">
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <TicketForm ticket={query.data} />
        )}
        <InfoSectionsEditor category="ticket" title="요금 안내" sectionPlaceholder="입장 요금 안내" publicPath={PUBLIC_PAGE_PATHS.ticket} />
      </div>
    </>
  );
}
