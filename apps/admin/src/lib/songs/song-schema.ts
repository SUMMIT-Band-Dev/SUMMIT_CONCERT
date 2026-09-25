import { z } from "zod";

// 서버 DTO(apps/api/src/songs/dto/{create,update}-song.dto.ts, songs.constants.ts)와
// 같은 규칙, 같은 문구다. 규칙이 어긋나면 "화면은 통과했는데 서버가 400"이 되므로
// 서버 DTO를 바꾸면 이 파일도 함께 바꾼다 (팀 쪽 team-schema.ts와 같은 방침).

export const SONG_TITLE_MAX_LENGTH = 200;
export const SINGER_MAX_LENGTH = 100;

export const SONG_MESSAGES = {
  titleRequired: "곡 제목을 입력해 주세요.",
  titleTooLong: `곡 제목은 ${SONG_TITLE_MAX_LENGTH}자를 넘을 수 없습니다.`,
  // DB 컬럼은 nullable이지만 서버가 필수로 받는다 — 비어 있으면 공개 사이트가
  // "SUMMIT Band"로 대체 표시해 잘못된 정보가 나가기 때문이다(songs.constants.ts).
  singerRequired: "가수를 입력해 주세요.",
  singerTooLong: `가수는 ${SINGER_MAX_LENGTH}자를 넘을 수 없습니다.`,
} as const;

const titleSchema = z
  .string()
  .trim()
  .min(1, { message: SONG_MESSAGES.titleRequired })
  .max(SONG_TITLE_MAX_LENGTH, { message: SONG_MESSAGES.titleTooLong });

const singerSchema = z
  .string()
  .trim()
  .min(1, { message: SONG_MESSAGES.singerRequired })
  .max(SINGER_MAX_LENGTH, { message: SONG_MESSAGES.singerTooLong });

/** 등록·수정 모두 제목+가수 두 필드다(서버도 같은 규칙으로 검사한다) */
export const songSchema = z.object({
  title: titleSchema,
  singer: singerSchema,
});

export type SongFormValues = z.infer<typeof songSchema>;
