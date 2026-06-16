"use client";

import { useEffect } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver: any;
  }
}

const MAP_DIV_ID = "naver-map-container";
const VENUE_LAT = 37.552555;
const VENUE_LNG = 126.91899;

export default function NaverMap() {
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

    function initMap() {
      const el = document.getElementById(MAP_DIV_ID);
      if (!el || !window.naver?.maps) return;

      const center = new window.naver.maps.LatLng(VENUE_LAT, VENUE_LNG);
      const map = new window.naver.maps.Map(el, {
        center,
        zoom: 17,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
      });

      const marker = new window.naver.maps.Marker({ position: center, map });

      const infoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="padding:10px 14px;font-family:sans-serif;min-width:120px;">
            <strong style="font-size:13px;">플렉스라운지</strong><br/>
            <span style="font-size:11px;color:#666;">서울 관악구 남부순환로 1937</span>
          </div>
        `,
        borderWidth: 0,
        disableAnchor: false,
        backgroundColor: "#fff",
        borderColor: "#ddd",
        anchorSize: new window.naver.maps.Size(10, 10),
      });
      infoWindow.open(map, marker);
    }

    // 이미 스크립트가 로드됐다면 바로 초기화
    if (window.naver?.maps) {
      initMap();
      return;
    }

    // 스크립트 중복 추가 방지
    const existingScript = document.getElementById("naver-map-script");
    if (existingScript) {
      existingScript.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.id = "naver-map-script";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  return (
    <div
      id={MAP_DIV_ID}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
