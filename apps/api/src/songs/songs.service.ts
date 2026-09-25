import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  mapForeignKeyViolation,
  mapRecordNotFound,
  mapUniqueViolation,
} from '../common/prisma-error.js';
import { TEAM_NOT_FOUND_MESSAGE } from '../teams/teams.constants.js';
import {
  SONG_ID_CONFLICT_MESSAGE,
  SONG_NOT_FOUND_MESSAGE,
} from './songs.constants.js';
import { invalidateAttempts } from '../youtube/youtube-attempt.js';
import { toSongResponse, type SongResponse } from './dto/song-response.js';
import type { YoutubeReviewStatus } from '../generated/prisma/enums.js';
import type { CreateSongDto } from './dto/create-song.dto.js';
import type { UpdateSongDto } from './dto/update-song.dto.js';

/**
 * `PrismaService`와 트랜잭션 클라이언트를 모두 받을 수 있는 최소 타입.
 * 트랜잭션 클라이언트는 `$transaction`/`$connect` 등만 빠진 같은 객체라
 * `setlist` 델리게이트와 `$queryRaw`의 타입은 동일하다.
 */
type SongClient = Pick<
  PrismaService,
  'setlist' | '$queryRaw' | 'youtubeSearchAttempt' | 'youtubeRecommendation'
>;

/** 중복 판정에 쓰는 최소 형태. 전체 행을 끌어올 필요가 없다. */
interface SongIdentity {
  id: bigint;
  title: string;
  singer: string | null;
}

/** 갱신 대상 컬럼. Prisma 네임스페이스 타입을 끌어오지 않고 필요한 것만 명시한다. */
interface SongUpdateData {
  title?: string;
  singer?: string;
  /** 제목·가수가 실제로 바뀔 때만 `pending`으로 되돌린다 (`update` 주석 참조). */
  youtubeReviewStatus?: YoutubeReviewStatus;
}

@Injectable()
export class SongsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 팀별 곡 조회 (PRD F008).
   *
   * 정렬은 `id` 오름차순이다. `Setlist`에는 순서 컬럼이 없고, 공개 프론트가
   * `.order("id", asc)`로 읽어 그 순서 그대로 렌더링하기 때문이다
   * (`src/lib/fetch-line-up-and-setlist.ts`). 관리자 화면이 다른 순서를 보여주면
   * "관리자에서 본 순서"와 "방문자가 보는 순서"가 갈린다.
   *
   * 한계: 새 곡은 항상 맨 뒤에 붙고 중간 삽입·순서 변경이 불가능하다.
   * 순서 컬럼 추가는 이번 단계 스코프 밖이다 (REFACTOR_NOTES §12).
   *
   * 없는 팀은 빈 배열이 아니라 404다 — 곡이 0건인 실제 팀(등록 직후 상태)과
   * 구분되어야 관리자 UI가 "잘못된 id"와 "아직 곡 없음"을 분기할 수 있다.
   */
  async findAllByTeam(teamId: bigint): Promise<SongResponse[]> {
    const team = await this.prisma.lineUp.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException(TEAM_NOT_FOUND_MESSAGE);
    }

    const songs = await this.prisma.setlist.findMany({
      where: { teamId },
      orderBy: { id: 'asc' },
    });

    return songs.map(toSongResponse);
  }

  /**
   * 곡 등록 (PRD F009).
   *
   * 트랜잭션 첫 단계에서 **대상 팀 행을 `FOR NO KEY UPDATE`로 잠근다.** 존재
   * 확인만으로는 관리자가 등록 버튼을 두 번 눌렀을 때(거의 동시 요청) 두 요청이
   * 중복 검사를 **함께 통과**할 수 있기 때문이다. `(teamId, title, singer)`에
   * unique 제약이 없어 DB가 걸러 주지도 않는다. 팀 행을 잠그면 같은 팀에 대한
   * 등록이 직렬화되어 뒤 요청은 앞 요청이 커밋한 곡을 보고 409로 떨어진다.
   *
   * `FOR UPDATE`가 아니라 `FOR NO KEY UPDATE`인 이유: 이 잠금의 목적은 팀 행의
   * **삭제·키 변경을 막는 것**이지 팀 정보 수정을 막는 것이 아니다. 같은 팀의
   * 팀명을 바꾸는 `PATCH /teams/:id`와 불필요하게 경합할 이유가 없다.
   */
  async create(teamId: bigint, dto: CreateSongDto): Promise<SongResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockTeamRow(tx, teamId);

      const siblings = await findSiblings(tx, teamId);
      assertNoDuplicate(siblings, dto.title, dto.singer);

      const created = await mapForeignKeyViolation(
        // PK 충돌(P2002)은 §11에서 실제로 났던 경로다 — id 시퀀스가 기존 데이터보다
        // 뒤처져 nextval이 이미 쓰인 id를 돌려주면 터진다. 현재 시퀀스는 맞춰져
        // 있지만(64/64), work03에서 id를 명시해 대량 삽입하면 재발할 수 있다.
        mapUniqueViolation(
          tx.setlist.create({
            data: { teamId, title: dto.title, singer: dto.singer },
          }),
          SONG_ID_CONFLICT_MESSAGE,
        ),
        TEAM_NOT_FOUND_MESSAGE,
      );

      return toSongResponse(created);
    });
  }

  /**
   * 곡 수정 (PRD F009). 제목·가수만 바꾼다.
   *
   * 반드시 곡 id로만 찾고 `teamId`는 건드리지 않는다 — DTO에 아예 없으므로
   * 전역 `forbidNonWhitelisted`가 400으로 막는다. 즉 이 API로 곡의 팀을 옮길 수 없다.
   *
   * 이미 채워진 `albumCoverUrl`/`youtubeUrl`은 **초기화하지 않는다.** 이 엔드포인트는
   * "오타 교정"과 "다른 곡으로 교체"를 구분할 수 없는데, 두 경우의 비용이 비대칭이기
   * 때문이다 — 앨범 커버는 F010으로 언제든 다시 받을 수 있지만, 승인된 유튜브 링크는
   * 사람 검토와 일일 quota가 든 자산이라 잃으면 복구 비용이 크다. 교체 의도일 때의
   * 재매칭은 F010/F013에서 명시적 동작으로 처리한다 (REFACTOR_NOTES §12).
   *
   * 중복 검사는 **수정 후 값** 기준이고 자기 자신은 제외한다. 같은 값으로 다시
   * 보내면 409가 아니라 200이다(no-op).
   *
   * ## 제목·가수가 **실제로** 바뀌면 검토 상태를 되돌린다 (work02-6b에서 추가)
   *
   * §14가 남긴 결함이 있었다. URL을 유지하는 위 결정 때문에, 곡을 **다른 곡으로 교체하는
   * 수정**을 해도 `approved`가 그대로 남고, `approved`는 배치 재검색 대상이 아니라서
   * **이전 곡의 영상이 승인 상태로 영원히 남았다.**
   *
   * 그래서 정규화 비교로 실제 변경일 때만 `youtubeReviewStatus`를 `pending`으로 되돌리고
   * 열린 추천을 닫는다. **URL은 그대로 둔다** — 위 비대칭 논리는 여전히 유효하다.
   *
   * 이 조합이 중요하다: 배치 대상 조건이 `youtube_url IS NULL AND pending`이므로,
   * URL이 남아 있는 한 **쿼터를 쓰는 재검색은 일어나지 않는다.** 이 변경의 효과는
   * "URL은 있는데 pending"이라는 표식이고, 7단계 관리자 UI가 그것을 *재검토 필요* 목록으로
   * 보여 준다. 오타 교정도 이 목록에 걸리지만 비용은 사람이 한 번 훑는 것뿐이고,
   * 반대쪽 비용(교체된 곡이 영원히 재검토되지 않음)이 훨씬 크다.
   *
   * 잠금 순서는 `Line Up` → `Setlist` → `YoutubeSearchAttempt`로 전역 규칙을 따른다
   * (`common/lock-order.ts`).
   */
  async update(id: bigint, dto: UpdateSongDto): Promise<SongResponse> {
    // whitelist는 "선언되지 않은 필드"를 막을 뿐 "아무 필드도 없는 본문"은 통과시킨다.
    // 조용히 200을 주면 클라이언트가 수정에 성공했다고 오해한다.
    if (dto.title === undefined && dto.singer === undefined) {
      throw new BadRequestException('수정할 항목을 하나 이상 입력해 주세요.');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.setlist.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException(SONG_NOT_FOUND_MESSAGE);
      }

      // 소속 팀이 있을 때만 중복을 따진다. `teamId`가 NULL이면 "같은 팀 안"이라는
      // 비교 대상 자체가 정의되지 않는다 (실데이터에는 없지만 컬럼이 nullable이다).
      if (current.teamId !== null) {
        // 등록과 같은 이유로 팀 행을 먼저 잠근다. 잠그지 않으면 동시 수정 또는
        // 수정-등록 경합이 중복 검사를 함께 통과할 수 있다.
        await lockTeamRow(tx, current.teamId);

        const nextTitle = dto.title ?? current.title;
        const nextSinger = dto.singer ?? current.singer;
        const siblings = (await findSiblings(tx, current.teamId)).filter(
          (song) => song.id !== id,
        );

        assertNoDuplicate(siblings, nextTitle, nextSinger);
      }

      const data: SongUpdateData = {};
      if (dto.title !== undefined) {
        data.title = dto.title;
      }
      if (dto.singer !== undefined) {
        data.singer = dto.singer;
      }

      // 곡이 실제로 "다른 곡"이 됐는지 **중복 검사와 같은 정규화 규칙**으로 본다.
      // 대소문자·앞뒤 공백·자모 분리만 다른 수정은 표기 교정이지 곡 교체가 아니므로
      // 검토 상태를 건드리지 않는다.
      const identityChanged =
        (dto.title !== undefined &&
          normalizeForCompare(dto.title) !== normalizeForCompare(current.title)) ||
        (dto.singer !== undefined &&
          normalizeForCompare(dto.singer) !== normalizeForCompare(current.singer));

      if (identityChanged) {
        data.youtubeReviewStatus = 'pending';
      }

      const updated = await mapRecordNotFound(
        tx.setlist.update({ where: { id }, data }),
        SONG_NOT_FOUND_MESSAGE,
      );

      if (identityChanged) {
        await invalidateAttempts(tx, id);
      }

      return toSongResponse(updated);
    });
  }
}

/**
 * 대상 팀 행을 잠그고 존재를 확인한다. 0행이면 404.
 *
 * Prisma에는 행 수준 잠금을 거는 API가 없어 raw 쿼리를 쓴다. 태그드 템플릿이라
 * `teamId`는 파라미터로 바인딩되며 문자열로 합쳐지지 않는다.
 * 호출자가 같은 트랜잭션의 클라이언트를 넘겨야 잠금이 유지된다.
 */
async function lockTeamRow(tx: SongClient, teamId: bigint): Promise<void> {
  const locked = await tx.$queryRaw<
    Array<{ id: bigint }>
  >`SELECT id FROM "Line Up" WHERE id = ${teamId} FOR NO KEY UPDATE`;

  if (locked.length === 0) {
    throw new NotFoundException(TEAM_NOT_FOUND_MESSAGE);
  }
}

/** 중복 판정에 필요한 같은 팀의 곡들. 팀당 최대 6곡이라 전건을 가져와도 부담이 없다. */
function findSiblings(tx: SongClient, teamId: bigint): Promise<SongIdentity[]> {
  return tx.setlist.findMany({
    where: { teamId },
    select: { id: true, title: true, singer: true },
  });
}

/**
 * 비교용 정규화. **저장값에는 적용하지 않는다** (저장은 DTO의 trim까지만).
 *
 * NFC를 거는 이유는 한글 자모가 분리된 형태(NFD)로 입력되면 눈에 같아 보여도
 * 코드 포인트가 달라 중복 판정을 빠져나가기 때문이다 — macOS에서 복사한 문자열이
 * 대표적이다. 가수가 NULL이면 빈 문자열로 취급해 공개 프론트의 그룹핑 기준과 맞춘다.
 */
function normalizeForCompare(value: string | null): string {
  return (value ?? '').normalize('NFC').trim().toLowerCase();
}

/**
 * 같은 팀 안에 제목+가수가 같은 곡이 있으면 409.
 *
 * 허용하면 공개 프론트가 `title + artist`가 같은 뒤 행을 **조용히 버려서**
 * (`src/app/setlist/page.tsx`, `src/app/event-goods/page.tsx` — 둘 다 팀별 배열
 * 안에서만 비교한다) "관리자엔 보이는데 사이트엔 안 나오는 곡"이 생긴다.
 * 게다가 곡 순서 컬럼이 없어 동일한 두 행은 애초에 구분할 방법이 없다.
 */
function assertNoDuplicate(
  siblings: SongIdentity[],
  title: string,
  singer: string | null,
): void {
  const targetTitle = normalizeForCompare(title);
  const targetSinger = normalizeForCompare(singer);

  const duplicated = siblings.some(
    (song) =>
      normalizeForCompare(song.title) === targetTitle &&
      normalizeForCompare(song.singer) === targetSinger,
  );

  if (duplicated) {
    throw new ConflictException(
      `'${title} - ${singer ?? ''}'은(는) 이 팀에 이미 등록된 곡입니다.`,
    );
  }
}
