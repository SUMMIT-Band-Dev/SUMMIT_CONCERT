/**
 * 프레임워크·본문 파서가 만드는 오류를 대신할 **고정 문구**.
 *
 * 원본 메시지는 요청 값을 담을 수 있다 — 깨진 JSON의 파서 오류는 본문 앞 10자를 그대로 에코한다
 * (`Unexpected token 'P', "PASSWORD_L"... is not valid JSON`). 그래서 원본을 다듬어 쓰지 않고
 * 처음부터 우리 문구로 바꾼다. 어떤 문구도 요청에서 온 값을 포함하지 않는다.
 */
export const INVALID_BODY_MESSAGE = '요청 본문의 형식이 올바르지 않습니다.';
export const BODY_TOO_LARGE_MESSAGE = '요청 본문이 너무 큽니다.';
export const UNSUPPORTED_ENCODING_MESSAGE = '지원하지 않는 요청 인코딩입니다.';
export const INVALID_URL_MESSAGE = '요청 주소의 형식이 올바르지 않습니다.';
export const ROUTE_NOT_FOUND_MESSAGE = '요청하신 경로를 찾을 수 없습니다.';
export const INTERNAL_ERROR_MESSAGE = '서버 오류가 발생했습니다.';

/** 상태코드별 고정 문구. 표에 없는 4xx는 일반 문구를 쓴다 */
export const FIXED_MESSAGE_BY_STATUS: Readonly<Record<number, string>> = {
  400: '잘못된 요청입니다.',
  413: BODY_TOO_LARGE_MESSAGE,
  415: UNSUPPORTED_ENCODING_MESSAGE,
};

export const GENERIC_CLIENT_ERROR_MESSAGE = '요청을 처리할 수 없습니다.';

/** 응답의 `error` 필드 값(Nest 내장 예외와 같은 표기) */
export const STATUS_PHRASE: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};
