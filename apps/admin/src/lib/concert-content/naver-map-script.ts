// 네이버 SDK에서 실제 사용하는 표면만 선언한다. SDK·타입 패키지는 추가하지 않는다.
export interface NaverLatLng {
  lat(): number;
  lng(): number;
}
export interface NaverMapInstance {
  setCenter(position: NaverLatLng): void;
  destroy?(): void;
}
export interface NaverMarkerInstance {
  setPosition(position: NaverLatLng): void;
  getPosition(): NaverLatLng;
  setMap(map: NaverMapInstance | null): void;
}
export interface NaverMapsNamespace {
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  Map: new (
    element: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom: number;
      mapTypeControl: boolean;
      scaleControl: boolean;
      mapDataControl: boolean;
    },
  ) => NaverMapInstance;
  Marker: new (options: { position: NaverLatLng; map: NaverMapInstance; draggable: boolean }) => NaverMarkerInstance;
  Event: {
    addListener(target: NaverMapInstance, event: "click", handler: (event: { coord: NaverLatLng }) => void): object;
    addListener(target: NaverMarkerInstance, event: "dragend", handler: () => void): object;
    removeListener(listener: object): void;
  };
}

declare global {
  interface Window {
    naver?: { maps?: NaverMapsNamespace };
    navermap_authFailure?: () => void;
  }
}

// 오리진은 CSP의 NAVER_MAP_ORIGINS.script[0]과 같다. 테스트로 두 값의 일치를 확인한다.
export const NAVER_MAP_SCRIPT_BASE_URL = "https://oapi.map.naver.com/openapi/v3/maps.js";
const SCRIPT_ID = "naver-map-script";
let pendingScript: Promise<NaverMapsNamespace> | null = null;

export class NaverMapConfigError extends Error {
  constructor() {
    super("지도 키가 설정되지 않았습니다.");
    this.name = "NaverMapConfigError";
  }
}

export function buildNaverMapScriptUrl(clientId: string | undefined): string | null {
  const value = clientId?.trim();
  return value ? `${NAVER_MAP_SCRIPT_BASE_URL}?ncpKeyId=${encodeURIComponent(value)}` : null;
}

/** 브라우저에서만 호출한다. 재방문·동시 마운트는 동일한 SDK와 진행 중 Promise를 재사용한다. */
export function loadNaverMapScript(clientId: string | undefined): Promise<NaverMapsNamespace> {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (pendingScript) return pendingScript;
  const url = buildNaverMapScriptUrl(clientId);
  if (!url) return Promise.reject(new NaverMapConfigError());

  pendingScript = new Promise<NaverMapsNamespace>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
    const previousAuthFailure = window.navermap_authFailure;
    function cleanup() {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (window.navermap_authFailure === handleAuthFailure) window.navermap_authFailure = previousAuthFailure;
    }
    function fail() {
      cleanup();
      script.remove();
      reject(new Error("네이버 지도를 불러오지 못했습니다."));
    }
    function handleLoad() {
      if (!window.naver?.maps) {
        fail();
        return;
      }
      cleanup();
      resolve(window.naver.maps);
    }
    function handleError() {
      fail();
    }
    // 공식 인증 실패 콜백: https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html
    function handleAuthFailure() {
      fail();
    }
    window.navermap_authFailure = handleAuthFailure;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = url;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    pendingScript = null;
    throw error;
  });
  return pendingScript;
}
