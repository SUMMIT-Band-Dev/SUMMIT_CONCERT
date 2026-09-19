import type { Request } from 'express';

/**
 * JWT에 싣는 클레임.
 *
 * `sub`(AdminUser.id) 하나만 담는다. username을 넣지 않는 이유는 두 가지다.
 * 1) 토큰은 URL/로그/브라우저 저장소에 남기 쉬운 값이라 최소한만 담는다
 * 2) 관리자 페이지에 팀명뿐 아니라 계정 정보 수정이 생겼을 때,
 *    토큰 안의 username이 DB와 어긋난 채로 살아있는 상황을 만들지 않는다
 *
 * `iat`/`exp`는 @nestjs/jwt가 서명 시 자동으로 붙인다.
 */
export interface JwtPayload {
  /** AdminUser.id. DB 타입이 int8(BigInt)이라 JSON 직렬화가 가능한 문자열로 담는다 */
  sub: string;
}

/** Guard가 검증에 성공하면 `admin`을 채워 넣은 요청 객체 */
export interface AuthenticatedRequest extends Request {
  admin?: JwtPayload;
}
