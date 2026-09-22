import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// "색은 :root 변수에만 두고 컴포넌트에 하드코딩하지 않는다"(7c-1b 결정)를 지키는 검사.
// 나중에 디자인을 교체할 때 globals.css 의 :root 한 곳만 고치면 되도록, 컴포넌트·페이지에 색이 새어 나오지 않게 한다.

const ROOT = join(__dirname, "..");

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(tsx|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const FILES = ["app", "components", "lib"].flatMap((dir) => listSourceFiles(join(ROOT, dir)));

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "#hex 색상", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb()/hsl()/oklch() 색상", pattern: /\b(rgb|rgba|hsl|hsla|oklch|oklab|lch)\(/ },
  { name: "Tailwind 팔레트 클래스(bg-blue-500 등)", pattern: new RegExp(String.raw`\b(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|shadow|accent|caret)-(${PALETTE})-\d{2,3}\b`) },
  { name: "bg-white/bg-black/text-white/text-black 등 고정 흑백", pattern: /\b(bg|text|border|ring|fill|stroke)-(white|black)\b/ },
  { name: "임의값 색상 클래스(bg-[#…])", pattern: /\b(bg|text|border|ring|fill|stroke)-\[(#|rgb|hsl|oklch)/ },
];

describe("디자인 토큰 하드코딩 금지", () => {
  it("검사 대상 파일이 있다", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  // csp.ts 는 색이 아니라 CSP 문자열이고 test 는 제외했다
  const targets = FILES.filter((file) => !file.endsWith(join("lib", "csp.ts")));

  it.each(RULES)("컴포넌트·페이지·라이브러리에 $name 이 없다", ({ pattern }) => {
    const offenders = targets.filter((file) => pattern.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => file.slice(ROOT.length + 1))).toEqual([]);
  });
});
