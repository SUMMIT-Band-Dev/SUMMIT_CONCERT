"use client";
import { PageHeader } from "@/components/layout/page-header";
import { PUBLIC_PAGE_PATHS } from "@/lib/concert-content/public-page-url";
import { InfoSectionsEditor } from "./info-sections-editor";

export function NoticePageClient() {
  return (
    <>
      <PageHeader title="관람 유의사항" description="관람객에게 안내할 섹션과 문장을 관리합니다." />
      <InfoSectionsEditor
        category="notice"
        title="관람 유의사항"
        sectionPlaceholder="관객 안전 안내"
        publicPath={PUBLIC_PAGE_PATHS.notice}
      />
    </>
  );
}
