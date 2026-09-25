import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // next.config.ts에서 이미지 최적화를 껐으므로(images.unoptimized) next/image를 써도 얻는 것이 없다.
      // 관리자 화면이 표시하는 이미지는 외부 공개 URL과 blob: 미리보기뿐이라 <img>가 맞다.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
