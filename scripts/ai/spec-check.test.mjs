// 명세 해석·spec PR 형식 검사 테스트 — `node --test "scripts/ai/*.test.mjs"` 로 실행
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { checkSpecPr } from "./spec-check.mjs";
import { CI_COMMANDS, isCiCriterion, parseCriteria, parseSpec, specHash } from "./spec-file.mjs";

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
    "AC-03는 문장 맨 앞의 참조라 정의가 아니다",
    "AC-04 접두 기호 없는 줄도 정의가 아니다",
    "- AC-06는 조사가 붙으면 참조다",
    "- **AC-07**: 굵게와 콜론",
  ].join("\n");
  assert.deepEqual(parseCriteria(content), [
    { id: "AC-01", manual: false, ci: false },
    { id: "AC-02", manual: false, ci: false },
    { id: "AC-03", manual: true, ci: false },
    { id: "AC-04", manual: false, ci: false },
    { id: "AC-05", manual: false, ci: false },
    { id: "AC-07", manual: false, ci: false },
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

test("CI 기준: 범위 + CI가 실행하는 명령만 있는 문장", () => {
  const yes = [
    " `apps/api`에서 `npm run build`·`npm run typecheck`·`npm run lint`·`npm test`가 통과한다",
    " `apps/admin`에서 `npm run build`, `npm test`가 모두 통과한다.",
    " 루트에서 `npm run lint`·`npm run typecheck`가 통과한다",
    " `npm run lint`가 통과한다",
    "** `apps/api`에서 `npm test`가 통과한다",
  ];
  for (const text of yes) assert.equal(isCiCriterion(text), true, text);

  const no = [
    " 루트에서 `npm run build`가 통과한다", // CI web 잡은 build를 실행하지 않는다
    " `apps/api`에서 `npx prisma validate`가 성공한다",
    " `apps/api`에서 `npm test`가 통과하고 저장 API가 200을 반환한다", // 다른 주장이 섞임
    " `apps/api`에서 `npm run e2e`가 통과한다",
    " 저장하면 목록이 갱신된다",
    " [manual] `apps/api`에서 `npm test`가 통과한다",
  ];
  for (const text of no) assert.equal(isCiCriterion(text), false, text);
});

test("CI 기준은 [manual]과 겹치지 않고 parseCriteria가 표시한다", () => {
  const criteria = parseCriteria(
    [
      "- AC-01 `apps/api`에서 `npm test`가 통과한다",
      "- AC-02 [manual] `apps/api`에서 `npm test`가 통과한다",
      "- AC-03 화면에 표시된다",
    ].join("\n"),
  );
  assert.deepEqual(criteria, [
    { id: "AC-01", manual: false, ci: true },
    { id: "AC-02", manual: true, ci: false },
    { id: "AC-03", manual: false, ci: false },
  ]);
});

test("CI_COMMANDS가 ci.yml의 잡별 npm 명령과 일치한다", () => {
  const yml = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const actual = { root: [], "apps/api": [], "apps/admin": [] };
  // jobs 아래 잡 블록(들여쓰기 2칸 키)마다 working-directory와 npm 실행 명령을 모은다
  const jobs = yml.slice(yml.indexOf("\njobs:")).split(/\n {2}(?=[a-z][a-z0-9_-]*:\s*\n)/).slice(1);
  for (const job of jobs) {
    const scope = /working-directory:\s*(apps\/api|apps\/admin)/.exec(job)?.[1] ?? "root";
    for (const match of job.matchAll(/run:\s*(npm (?:run [a-z:-]+|test))\s*$/gm)) {
      actual[scope].push(match[1]);
    }
  }
  for (const scope of Object.keys(CI_COMMANDS)) {
    assert.deepEqual([...actual[scope]].sort(), [...CI_COMMANDS[scope]].sort(), scope);
  }
});

test("실제 명세 WORK05-T2: AC-08만 CI 기준, AC-10은 manual", () => {
  const content = readFileSync(new URL("../../docs/specs/WORK05-T2.md", import.meta.url), "utf8");
  const criteria = parseCriteria(content);
  assert.deepEqual(
    criteria.filter((item) => item.ci).map((item) => item.id),
    ["AC-08"],
  );
  assert.deepEqual(
    criteria.filter((item) => item.manual).map((item) => item.id),
    ["AC-10"],
  );
});
