"use client";

import { useId } from "react";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listInfoSections, updateInfoSections, type InfoCategory } from "@/lib/api/concert-content";
import type { InfoSection } from "@/lib/api/types";
import {
  infoSectionsSchema,
  toInfoSectionsFormValues,
  toInfoSectionsPayload,
  type InfoSectionsFormValues,
} from "@/lib/concert-content/info-sections-schema";
import { queryKeys } from "@/lib/query-keys";
import { SaveResultNotice } from "./save-result-notice";

interface InfoSectionsEditorProps {
  category: InfoCategory;
  title: string;
  sectionPlaceholder: string;
  publicPath: string;
}

function SectionFields({
  form,
  index,
  sectionPlaceholder,
}: {
  form: UseFormReturn<InfoSectionsFormValues>;
  index: number;
  sectionPlaceholder: string;
}) {
  const id = useId();
  const items = useFieldArray({ control: form.control, name: `sections.${index}.items` });
  const errors = form.formState.errors.sections?.[index];
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>섹션 제목</Label>
        <Input
          id={`${id}-title`}
          placeholder={sectionPlaceholder}
          {...form.register(`sections.${index}.title`)}
          aria-invalid={!!errors?.title}
          aria-describedby={errors?.title ? `${id}-title-error` : undefined}
        />
        {errors?.title ? (
          <p id={`${id}-title-error`} role="alert" className="text-small text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>
      {items.fields.map((item, itemIndex) => (
        <div key={item.id} className="grid gap-2 rounded-lg border p-3">
          <Label htmlFor={`${id}-${item.id}`}>안내 문장 {itemIndex + 1}</Label>
          <Textarea
            id={`${id}-${item.id}`}
            {...form.register(`sections.${index}.items.${itemIndex}.content`)}
            aria-invalid={!!errors?.items?.[itemIndex]?.content}
            aria-describedby={errors?.items?.[itemIndex]?.content ? `${id}-${item.id}-error` : undefined}
          />
          {errors?.items?.[itemIndex]?.content ? (
            <p id={`${id}-${item.id}-error`} role="alert" className="text-small text-destructive">
              {errors.items[itemIndex]?.content?.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="항목 위로 이동"
              disabled={itemIndex === 0}
              onClick={() => items.move(itemIndex, itemIndex - 1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="항목 아래로 이동"
              disabled={itemIndex === items.fields.length - 1}
              onClick={() => items.move(itemIndex, itemIndex + 1)}
            >
              <ArrowDown />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="항목 삭제" onClick={() => items.remove(itemIndex)}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      {errors?.items?.root?.message ? (
        <p role="alert" className="text-small text-destructive">
          {errors.items.root.message}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={items.fields.length >= 50}
        className="justify-self-start"
        onClick={() => items.append({ content: "" })}
      >
        항목 추가
      </Button>
    </div>
  );
}

function InfoSectionsForm({
  sections: initialSections,
  category,
  sectionPlaceholder,
  publicPath,
}: Omit<InfoSectionsEditorProps, "title"> & { sections: InfoSection[] }) {
  const queryClient = useQueryClient();
  const form = useForm<InfoSectionsFormValues>({
    resolver: zodResolver(infoSectionsSchema),
    defaultValues: toInfoSectionsFormValues(initialSections),
  });
  const sections = useFieldArray({ control: form.control, name: "sections" });
  const mutation = useMutation({
    mutationFn: (values: InfoSectionsFormValues) => updateInfoSections(category, toInfoSectionsPayload(values)),
    onSuccess: async ({ data }) => {
      // 서버가 매번 새 id를 발급하므로 응답 전체로 폼과 필드 배열을 리셋한다.
      form.reset(toInfoSectionsFormValues(data));
      await queryClient.invalidateQueries({ queryKey: queryKeys.infoSections(category) });
    },
  });
  return (
    <form noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4">
      <p className="text-small text-muted-foreground">저장해야 사이트에 반영됩니다</p>
      <fieldset disabled={mutation.isPending} className="grid gap-4">
        {sections.fields.length === 0 ? (
          <p className="text-body text-muted-foreground">{"등록된 안내가 없습니다. '섹션 추가'로 시작하세요."}</p>
        ) : null}
        {sections.fields.map((section, index) => (
          <div key={section.id} className="grid gap-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">섹션 {index + 1}</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="섹션 위로 이동"
                  disabled={index === 0}
                  onClick={() => sections.move(index, index - 1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="섹션 아래로 이동"
                  disabled={index === sections.fields.length - 1}
                  onClick={() => sections.move(index, index + 1)}
                >
                  <ArrowDown />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="섹션 삭제" onClick={() => sections.remove(index)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <SectionFields form={form} index={index} sectionPlaceholder={sectionPlaceholder} />
          </div>
        ))}
        {form.formState.errors.sections?.root?.message ? (
          <p role="alert" className="text-small text-destructive">
            {form.formState.errors.sections.root.message}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={sections.fields.length >= 20}
          className="justify-self-start"
          onClick={() => sections.append({ title: "", items: [] })}
        >
          섹션 추가
        </Button>
      </fieldset>
      {mutation.isError ? <ErrorState error={mutation.error} /> : null}
      {mutation.isSuccess ? <SaveResultNotice revalidated={mutation.data.revalidated} publicPath={publicPath} /> : null}
      <Button type="submit" disabled={mutation.isPending} className="justify-self-start">
        {mutation.isPending ? "저장 중…" : "저장"}
      </Button>
    </form>
  );
}

export function InfoSectionsEditor({ title, ...props }: InfoSectionsEditorProps) {
  const query = useQuery({
    queryKey: queryKeys.infoSections(props.category),
    queryFn: ({ signal }) => listInfoSections(props.category, { signal }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <InfoSectionsForm key={props.category} sections={query.data} {...props} />
        )}
      </CardContent>
    </Card>
  );
}
