"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (
          el: HTMLElement,
          opts: {
            center: object;
            zoom: number;
            mapTypeControl?: boolean;
            scaleControl?: boolean;
            logoControl?: boolean;
            mapDataControl?: boolean;
          },
        ) => object;
        LatLng: new (lat: number, lng: number) => object;
        Marker: new (opts: { position: object; map: object }) => void;
      };
    };
  }
}

const VENUE_LAT = 37.5033;
const VENUE_LNG = 126.9499;

export default function NaverMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

    function initMap() {
      if (!mapRef.current || !window.naver?.maps) return;

      isInitialized.current = true;

      const center = new window.naver.maps.LatLng(VENUE_LAT, VENUE_LNG);
      const map = new window.naver.maps.Map(mapRef.current, {
        center,
        zoom: 17,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
      });

      new window.naver.maps.Marker({ position: center, map });
    }

    const existingScript = document.getElementById("naver-map-script");
    if (existingScript) {
      if (window.naver?.maps) {
        initMap();
      } else {
        existingScript.addEventListener("load", initMap);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "naver-map-script";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  return <div ref={mapRef} className="h-full w-full" />;
}
