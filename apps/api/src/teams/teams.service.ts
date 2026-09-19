import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseBigIntId } from '../common/parse-bigint.pipe.js';
import { mapRecordNotFound, mapUniqueViolation } from '../common/prisma-error.js';
import { PERFORMANCE_ORDER_MAX, TEAM_NOT_FOUND_MESSAGE } from './teams.constants.js';
import { toTeamResponse, type TeamResponse } from './dto/team-response.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';
import type { ReorderTeamsDto } from './dto/reorder-teams.dto.js';

/**
 * `PrismaService`와 트랜잭션 클라이언트를 모두 받을 수 있는 최소 타입.
 * 트랜잭션 클라이언트는 `$transaction`/`$connect` 등만 빠진 같은 객체라
 * `lineUp` 델리게이트의 타입은 동일하다.
 */
type LineUpClient = Pick<PrismaService, 'lineUp'>;

/** 갱신 대상 컬럼. Prisma 네임스페이스 타입을 끌어오지 않고 필요한 것만 명시한다. */
interface TeamUpdateData {
  teamName?: string;
  day?: string;
  performanceOrder?: number;
}

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 전체 팀 조회 (PRD F003).
   *
   * 정렬은 day → performanceOrder → id. `performanceOrder`가 전체 통틀어
   * 1..N이 아니라 **일자별로 1..N**이라(실데이터 day1=1..7, day2=1..8)
   * day를 먼저 잡지 않으면 두 일자의 1번이 뒤섞인다.
   *
   * day는 문자열 정렬이므로 `day10`이 `day2`보다 앞에 온다. 현재 day1/day2뿐이라
   * 그대로 두었다 (REFACTOR_NOTES §11 참조).
   */
  async findAll(): Promise<TeamResponse[]> {
    const teams = await this.prisma.lineUp.findMany({
      orderBy: [
        { day: { sort: 'asc', nulls: 'last' } },
        { performanceOrder: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });

    return teams.map(toTeamResponse);
  }

  /**
   * 팀 등록 (PRD F004).
   *
   * 같은 일자에 이미 쓰이는 순서면 409로 거부한다. 뒤로 밀어 주지 않는 이유는
   * 재정렬 전용 엔드포인트가 따로 있기 때문이다 — 등록이 다른 팀의 순서까지
   * 건드리는 두 번째 경로가 되면 "왜 저 팀이 밀렸는지"를 추적할 수 없게 된다.
   *
   * 중복 확인과 INSERT를 한 트랜잭션에 묶었지만, `(day, performanceOrder)`에
   * unique 제약이 없어 동시 요청에 대한 레이스가 완전히 닫히지는 않는다.
   * 관리자 1인 전제라 수용하고 기록만 남긴다 (REFACTOR_NOTES §11).
   */
  async create(dto: CreateTeamDto): Promise<TeamResponse> {
    return this.prisma.$transaction(async (tx) => {
      const taken = await tx.lineUp.findFirst({
        where: { day: dto.day, performanceOrder: dto.performanceOrder },
        select: { teamName: true },
      });

      if (taken) {
        throw new ConflictException(
          `${dto.day}의 ${dto.performanceOrder}번 순서는 이미 '${taken.teamName}' 팀이 사용 중입니다.`,
        );
      }

      // PK 충돌(P2002)이 여기서 실제로 났던 적이 있다 — id 시퀀스가 기존 데이터보다
      // 뒤처져 있어 nextval이 이미 쓰인 id를 돌려줬기 때문이다. 시퀀스는
      // 20260919210000_resync_id_sequences로 교정했지만, 같은 방식으로 데이터를
      // 직접 밀어 넣으면 재발할 수 있어 500 대신 원인을 말해 주도록 감싼다.
      const created = await mapUniqueViolation(
        tx.lineUp.create({
          data: {
            teamName: dto.teamName,
            day: dto.day,
            performanceOrder: dto.performanceOrder,
          },
        }),
        // 입력값 문제가 아니라는 것을 분명히 한다 — 같은 409라도 "순서 중복"과 원인이 다르다.
        '서버 측 id 발급이 충돌해 팀을 등록하지 못했습니다. 입력값 문제가 아니며, id 시퀀스 재동기화가 필요할 수 있습니다.',
      );

      return toTeamResponse(created);
    });
  }

  /**
   * 팀 정보 수정 (PRD F005).
   *
   * 반드시 id로만 찾고 id를 바꾸지 않는다. 팀명을 키로 쓰면 팀명을 수정하는 순간
   * `Setlist.teamId` FK와의 연결이 끊긴다 — 이번 work02에서 문자열 매칭을
   * FK로 정규화한 이유가 바로 이것이다.
   */
  async update(id: bigint, dto: UpdateTeamDto): Promise<TeamResponse> {
    // whitelist는 "선언되지 않은 필드"를 막을 뿐 "아무 필드도 없는 본문"은 통과시킨다.
    // 조용히 200을 주면 클라이언트가 수정에 성공했다고 오해한다.
    if (dto.teamName === undefined && dto.day === undefined) {
      throw new BadRequestException('수정할 항목을 하나 이상 입력해 주세요.');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.lineUp.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException(TEAM_NOT_FOUND_MESSAGE);
      }

      const data: TeamUpdateData = {};
      if (dto.teamName !== undefined) {
        data.teamName = dto.teamName;
      }

      // 일자를 옮기면 원래 순서값은 의미를 잃는다 — 대상 일자에 같은 번호가
      // 이미 있을 수 있기 때문이다. 대상 일자의 맨 뒤로 보내고, 원래 일자에
      // 생기는 번호 공백은 다음 재정렬이 1..N으로 복구한다(공백 자체는 정렬에 무해).
      //
      // 같은 day를 그대로 보낸 경우에는 재배치하지 않는다(no-op).
      // max+1 조회와 갱신이 같은 트랜잭션 안에 있어야 그 사이에 다른 요청이
      // 같은 번호를 가져가지 않는다.
      if (dto.day !== undefined && dto.day !== current.day) {
        data.day = dto.day;
        data.performanceOrder = await this.nextPerformanceOrder(tx, dto.day);
      }

      const updated = await mapRecordNotFound(
        tx.lineUp.update({ where: { id }, data }),
        TEAM_NOT_FOUND_MESSAGE,
      );

      return toTeamResponse(updated);
    });
  }

  /**
   * 공연 순서 일괄 재정렬 (PRD F006).
   *
   * 부분 목록은 허용하지 않는다 — 빠진 팀의 순서값이 그대로 남아 1..N 연속성이
   * 깨지기 때문이다. 요청 집합이 해당 일자 팀 전체와 정확히 일치할 때만 진행한다.
   *
   * `(day, performanceOrder)`에 unique 제약이 없어(2026-09-19 실제 DB 확인)
   * 순서를 맞바꾸는 중간 상태가 충돌하지 않는다 — 임시 오프셋 같은 우회가 필요 없다.
   */
  async reorder(dto: ReorderTeamsDto): Promise<TeamResponse[]> {
    const requestedIds = dto.teamIds.map((teamId) => {
      const parsed = parseBigIntId(teamId);
      if (parsed === null) {
        throw new BadRequestException(`팀 id 형식이 올바르지 않습니다: ${teamId}`);
      }
      return parsed;
    });

    assertNoDuplicateIds(requestedIds);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.lineUp.findMany({
        where: { day: dto.day },
        select: { id: true },
      });

      if (existing.length === 0) {
        throw new BadRequestException(`${dto.day}에 등록된 팀이 없습니다.`);
      }

      assertSameTeamSet(
        existing.map((team) => team.id),
        requestedIds,
        dto.day,
      );

      // 배열 순서대로 1..N을 부여한다. 트랜잭션이므로 중간에 실패하면 전부 롤백된다.
      // 동시 실행(Promise.all) 대신 순차 실행 — 같은 트랜잭션 클라이언트에
      // 쿼리를 병렬로 흘리면 실행 순서가 보장되지 않는다.
      for (const [index, teamId] of requestedIds.entries()) {
        await mapRecordNotFound(
          tx.lineUp.update({
            where: { id: teamId },
            data: { performanceOrder: index + 1 },
          }),
          TEAM_NOT_FOUND_MESSAGE,
        );
      }

      const reordered = await tx.lineUp.findMany({
        where: { day: dto.day },
        orderBy: [
          { performanceOrder: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ],
      });

      return reordered.map(toTeamResponse);
    });
  }

  /**
   * 해당 일자의 마지막 순서 + 1. 그 일자에 팀이 없으면 1.
   * 호출자가 같은 트랜잭션의 클라이언트를 넘겨야 조회-갱신 사이가 끊기지 않는다.
   */
  private async nextPerformanceOrder(tx: LineUpClient, day: string): Promise<number> {
    const { _max } = await tx.lineUp.aggregate({
      where: { day },
      _max: { performanceOrder: true },
    });

    const next = (_max.performanceOrder ?? 0) + 1;
    if (next > PERFORMANCE_ORDER_MAX) {
      // int2 상한을 넘기면 Postgres가 범위 초과로 실패해 500이 된다. 먼저 막는다.
      throw new ConflictException(`${day}의 공연 순서가 가득 찼습니다.`);
    }

    return next;
  }
}

function assertNoDuplicateIds(ids: bigint[]): void {
  const seen = new Set<string>();

  for (const id of ids) {
    const key = id.toString();
    if (seen.has(key)) {
      throw new BadRequestException(`중복된 팀 id가 있습니다: ${key}`);
    }
    seen.add(key);
  }
}

/** 요청한 id 집합이 해당 일자의 팀 전체와 정확히 일치하는지 확인한다. */
function assertSameTeamSet(
  existingIds: bigint[],
  requestedIds: bigint[],
  day: string,
): void {
  const existing = new Set(existingIds.map((id) => id.toString()));
  const requested = new Set(requestedIds.map((id) => id.toString()));

  const unknown = [...requested].filter((id) => !existing.has(id));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `${day}에 속하지 않는 팀 id가 포함돼 있습니다: ${unknown.join(', ')}`,
    );
  }

  if (requested.size !== existing.size) {
    throw new BadRequestException(
      `${day}의 전체 팀을 모두 포함해야 합니다. (${existing.size}개 중 ${requested.size}개)`,
    );
  }
}
