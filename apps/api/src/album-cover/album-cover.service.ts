import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapRecordNotFound } from '../common/prisma-error.js';
import { SONG_NOT_FOUND_MESSAGE } from '../songs/songs.constants.js';
import { toSongResponse, type SongResponse } from '../songs/dto/song-response.js';
import {
  ALBUM_COVER_TIMEOUT_MESSAGE,
  ALBUM_COVER_UPSTREAM_MESSAGE,
} from './album-cover.constants.js';
import { assertAlbumCoverUrl } from './album-cover-url.js';
import { buildSearchTerm, toAlbumCoverCandidates } from './album-cover.mapper.js';
import {
  ITUNES_CLIENT,
  ItunesTimeoutError,
  type ItunesClient,
} from './itunes.client.js';
import {
  OutboundRateLimitException,
  OutboundRateLimiter,
} from './outbound-rate-limiter.js';
import type { AlbumCoverCandidate } from './dto/album-cover-candidate.js';

@Injectable()
export class AlbumCoverService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ITUNES_CLIENT) private readonly itunes: ItunesClient,
    private readonly rateLimiter: OutboundRateLimiter,
  ) {}

  /**
   * 앨범 커버 후보 조회 (PRD F010). **DB에 쓰지 않는다.**
   *
   * 곡 등록/수정(`SongsService`)에 붙이지 않고 별도 엔드포인트로 뺀 이유는 잠금 때문이다.
   * 곡 등록·수정은 팀 행을 `FOR NO KEY UPDATE`로 잠근 트랜잭션 안에서 돌아가는데,
   * 거기에 외부 호출을 넣으면 **행 잠금을 쥔 채 최대 5초 네트워크를 기다리게** 되고
   * 같은 팀의 모든 쓰기가 그동안 직렬 대기한다. Prisma의 트랜잭션 타임아웃과도 겹친다.
   *
   * 결과가 0건인 것은 오류가 아니라 정상 응답이다 — 빈 배열로 200을 준다.
   * "검색은 됐는데 애플에 없는 곡"과 "검색 자체가 실패"는 관리자가 구분할 수 있어야 한다.
   */
  async findCandidates(songId: bigint): Promise<AlbumCoverCandidate[]> {
    const song = await this.prisma.setlist.findUnique({
      where: { id: songId },
      select: { title: true, singer: true },
    });
    if (!song) {
      throw new NotFoundException(SONG_NOT_FOUND_MESSAGE);
    }

    // 슬롯은 외부 호출 직전에만 소모한다. 위의 404가 예산을 쓰면 잘못된 id를 몇 번
    // 친 것만으로 정상 검색이 막힌다.
    const slot = this.rateLimiter.tryAcquire();
    if (!slot.allowed) {
      throw new OutboundRateLimitException(slot.retryAfterSeconds);
    }

    try {
      const tracks = await this.itunes.search(
        buildSearchTerm(song.title, song.singer),
      );
      return toAlbumCoverCandidates(tracks);
    } catch (error) {
      if (error instanceof ItunesTimeoutError) {
        throw new GatewayTimeoutException(ALBUM_COVER_TIMEOUT_MESSAGE);
      }
      throw new BadGatewayException(ALBUM_COVER_UPSTREAM_MESSAGE);
    }
  }

  /**
   * 선택한 후보를 반영 (PRD F010).
   *
   * `album` 한 컬럼만 바꾼다 — `title`/`singer`는 DTO에 없어서 전역
   * `forbidNonWhitelisted`가 400으로 막고, 이 메서드도 건드리지 않는다.
   *
   * 존재 확인 쿼리를 따로 돌리지 않고 `P2025`를 404로 매핑한다. 곡 등록(§12)과 달리
   * 같은 팀 안을 훑는 중복 검사가 없어 잠금도 트랜잭션도 필요 없기 때문이다.
   */
  async update(songId: bigint, url: string): Promise<SongResponse> {
    assertAlbumCoverUrl(url);

    const updated = await mapRecordNotFound(
      this.prisma.setlist.update({
        where: { id: songId },
        data: { albumCoverUrl: url },
      }),
      SONG_NOT_FOUND_MESSAGE,
    );

    return toSongResponse(updated);
  }
}
