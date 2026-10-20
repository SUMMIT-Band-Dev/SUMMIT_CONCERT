// 명세 해석·spec PR 형식 검사 테스트 — `node --test "scripts/ai/*.test.mjs"` 로 실행
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkSpecPr } from "./spec-check.mjs";
import { parseCriteria, parseSpec, specHash } from "./spec-file.mjs";

const spec = (revision, body = "- AC-01 첫 기준\n- AC-02 [manual] 화면 확인\n") =>
  `---\nspec_id: FEATURE-0001\nrevision: ${revision}\n---\n\n# 명세\n\n${body}`;

test("수용 기준 정의를 읽고 [manual]을 구분한다", () => {
  const content = [
    "- AC-01 목록",
    "- [ ] AC-02 체크박스",
    "### AC-03 [manual] 제목",
    "| AC-04 | 표 |",
    "**AC-05** 굵게",
    "본문에서 AC-01을 참조하는 문장은 정의가 아니다",
  ].join("\n");
  assert.deepEqual(parseCriteria(content), [
    { id: "AC-01", manual: false },
    { id: "AC-02", manual: false },
    { id: "AC-03", manual: true },
    { id: "AC-04", manual: false },
    { id: "AC-05", manual: false },
  ]);
});

test("정상 명세는 오류가 없고 CRLF도 같게 읽는다", () => {
  const result = parseSpec(spec(1), { specId: "FEATURE-0001", revision: 1 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.revision, 1);
  const crlf = spec(1).replace(/\n/g, "\r\n");
  assert.deepEqual(parseSpec(crlf).errors, []);
  assert.equal(specHash(crlf), specHash(spec(1)));
});

test("frontmatter·수용 기준 오류를 잡는다", () => {
  assert.ok(parseSpec("# 제목\n- AC-01 a").errors.length > 0);
  assert.ok(parseSpec("---\nspec_id: X-1\n---\n- AC-01 a").errors.some((e) => e.includes("revision")));
  assert.ok(parseSpec("---\nspec_id: X-1\nrevision: 01\n---\n- AC-01 a").errors.length > 0);
  assert.ok(parseSpec(spec(0, "기준 없음")).errors.some((e) => e.includes("AC-xx")));
  assert.ok(parseSpec(spec(0, "- AC-01 a\n- AC-01 b")).errors.some((e) => e.includes("두 번")));
  assert.ok(parseSpec(spec(0), { specId: "FEATURE-0002" }).errors.length > 0);
});

test("spec PR: 최초 명세는 revision 0", () => {
  const files = ["docs/specs/FEATURE-0001.md"];
  assert.equal(
    checkSpecPr({ branch: "spec/FEATURE-0001-r0", files, headContent: spec(0), baseContent: null }).ok,
    true,
  );
  assert.equal(
    checkSpecPr({ branch: "spec/FEATURE-0001-r1", files, headContent: spec(1), baseContent: null }).ok,
    false,
  );
});

test("spec PR: 보완은 develop의 revision + 1", () => {
  const files = ["docs/specs/FEATURE-0001.md"];
  const check = (branch, revision) =>
    checkSpecPr({ branch, files, headContent: spec(revision), baseContent: spec(0) }).ok;
  assert.equal(check("spec/FEATURE-0001-r1", 1), true);
  assert.equal(check("spec/FEATURE-0001-r0", 0), false);
  assert.equal(check("spec/FEATURE-0001-r2", 2), false);
});

test("spec PR: frontmatter와 브랜치가 다르면 실패", () => {
  const result = checkSpecPr({
    branch: "spec/FEATURE-0001-r1",
    files: ["docs/specs/FEATURE-0001.md"],
    headContent: spec(2),
    baseContent: spec(0),
  });
  assert.equal(result.ok, false);
});

test("spec PR: 다른 단위 명세를 함께 바꾸면 실패, 관련 문서는 허용", () => {
  const base = { branch: "spec/FEATURE-0001-r0", headContent: spec(0), baseContent: null };
  assert.equal(
    checkSpecPr({ ...base, files: ["docs/specs/FEATURE-0001.md", "docs/specs/prd-construction.md"] }).ok,
    true,
  );
  assert.equal(
    checkSpecPr({ ...base, files: ["docs/specs/FEATURE-0001.md", "docs/specs/FEATURE-0002.md"] }).ok,
    false,
  );
});

test("spec PR: 명세 파일 삭제는 실패", () => {
  const result = checkSpecPr({
    branch: "spec/FEATURE-0001-r1",
    files: ["docs/specs/FEATURE-0001.md"],
    headContent: null,
    baseContent: spec(0),
  });
  assert.equal(result.ok, false);
});
