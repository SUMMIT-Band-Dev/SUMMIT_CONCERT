#!/usr/bin/env node
// Claude Code hook: 세션 종료(SessionEnd) 시 Playwright MCP가 남긴 .playwright-mcp/ 출력물을 정리한다.
// 콘솔 로그/스크린샷/스냅샷은 세션 중에만 필요한 휘발성 데이터라 세션이 끝나면 지워도 무방하다.
// 정리 실패가 Claude Code 종료 흐름을 막으면 안 되므로 항상 exit 0으로 종료한다.

const fs = require("fs");
const path = require("path");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

async function main() {
  const raw = await readStdin();

  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const cwd = payload.cwd || process.cwd();
  const targetDir = path.join(cwd, ".playwright-mcp");

  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // 정리 실패는 무시 — 다음 세션에서 다시 시도되므로 흐름을 막지 않는다.
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
