// 단위 명세 파일(docs/specs/<SPEC_ID>.md) 해석 (docs/workflow/claude-codex-plan.md 6.1)
//
// 형식:
//   ---
//   spec_id: FEATURE-0001
//   revision: 0
//   ---
//   ...
//   - AC-01 <수용 기준>
//   - AC-02 [manual] <사람이 직접 확인하는 수용 기준>
//
// 수용 기준은 줄 맨 앞(목록 기호·체크박스·제목 기호 뒤 허용)에 AC-<두 자리 이상 숫자>로 정의한다.
// 본문 중간에 나오는 AC-xx는 참조로 보고 정의로 세지 않는다.

import { createHash } from "node:crypto";

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const REVISION_VALUE = /^(0|[1-9][0-9]*)$/;
// 줄 맨 앞의 정의: "- AC-01", "- [ ] AC-01", "### AC-01", "**AC-01**", "| AC-01 |" 등
const AC_DEFINITION =
  /^[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\|[ \t]*)?\**(AC-[0-9]{2,})\b(.*)$/gm;

function normalize(content) {
  return content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

// frontmatter의 key: value 한 줄짜리 값만 읽는다 (중첩 YAML은 쓰지 않는다)
export function parseFrontmatter(content) {
  const match = FRONTMATTER.exec(normalize(content));
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (pair) {
      fields[pair[1]] = pair[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  return fields;
}

// 수용 기준 정의 목록: [{ id, manual }]
export function parseCriteria(content) {
  const criteria = [];
  for (const match of normalize(content).matchAll(AC_DEFINITION)) {
    criteria.push({ id: match[1], manual: /\[manual\]/i.test(match[2]) });
  }
  return criteria;
}

// 명세 파일을 해석하고 형식 오류를 모은다. expected를 주면 spec_id·revision이 같은지도 본다
export function parseSpec(content, expected = {}) {
  const errors = [];
  const fields = parseFrontmatter(content);
  let specId = null;
  let revision = null;

  if (!fields) {
    errors.push("frontmatter(--- ... ---)가 파일 맨 앞에 없다");
  } else {
    specId = fields.spec_id ?? null;
    if (!specId) {
      errors.push("frontmatter에 spec_id가 없다");
    }
    if (fields.revision === undefined) {
      errors.push("frontmatter에 revision이 없다");
    } else if (!REVISION_VALUE.test(fields.revision)) {
      errors.push(`revision '${fields.revision}'이 0 이상의 정수가 아니다`);
    } else {
      revision = Number(fields.revision);
    }
  }

  if (expected.specId !== undefined && specId !== null && specId !== expected.specId) {
    errors.push(`spec_id '${specId}'이 '${expected.specId}'와 다르다`);
  }
  if (expected.revision !== undefined && revision !== null && revision !== expected.revision) {
    errors.push(`revision ${revision}이 ${expected.revision}과 다르다`);
  }

  const criteria = parseCriteria(content);
  if (criteria.length === 0) {
    errors.push("수용 기준(AC-xx)이 하나도 없다");
  }
  const seen = new Set();
  for (const { id } of criteria) {
    if (seen.has(id)) errors.push(`수용 기준 ${id}이 두 번 이상 정의됐다`);
    seen.add(id);
  }

  return { specId, revision, criteria, errors };
}

// 줄바꿈 차이(CRLF/LF)에 영향받지 않는 내용 해시
export function specHash(content) {
  return createHash("sha256").update(normalize(content)).digest("hex");
}
