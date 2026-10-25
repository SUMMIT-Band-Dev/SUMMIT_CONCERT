"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  loadNaverMapScript,
  NaverMapConfigError,
  type NaverMapsNamespace,
  type NaverMapInstance,
  type NaverMarkerInstance,
} from "@/lib/concert-content/naver-map-script";
import { roundCoordinate } from "@/lib/concert-content/venue-schema";

const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

interface VenueMapPickerProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}
interface MapResources {
  maps: NaverMapsNamespace;
  map: NaverMapInstance;
  marker: NaverMarkerInstance;
}

export function VenueMapPicker({ latitude, longitude, onChange }: VenueMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef<MapResources | null>(null);
  const initialCoordinates = useRef({ latitude, longitude });
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const readCoordinates = useEffectEvent(() => ({ latitude, longitude }));
  const reportPosition = useEffectEvent((lat: number, lng: number) => onChange(roundCoordinate(lat), roundCoordinate(lng)));

  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    loadNaverMapScript(CLIENT_ID)
      .then((maps) => {
        if (disposed || !containerRef.current) return;
        const current = readCoordinates();
        const position = Number.isFinite(current.latitude) && Number.isFinite(current.longitude) ? current : initialCoordinates.current;
        const center = new maps.LatLng(position.latitude, position.longitude);
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: 16,
          mapTypeControl: false,
          scaleControl: false,
          mapDataControl: false,
        });
        const marker = new maps.Marker({ position: center, map, draggable: true });
        const listeners = [
          // 공식 PointerEvent의 coord를 사용한다. dragend는 마커의 최종 위치를 읽는다.
          maps.Event.addListener(map, "click", (event) => {
            marker.setPosition(event.coord);
            reportPosition(event.coord.lat(), event.coord.lng());
          }),
          maps.Event.addListener(marker, "dragend", () => {
            const point = marker.getPosition();
            reportPosition(point.lat(), point.lng());
          }),
        ];
        resourcesRef.current = { maps, map, marker };
        release = () => {
          listeners.forEach((listener) => maps.Event.removeListener(listener));
          marker.setMap(null);
          map.destroy?.();
          resourcesRef.current = null;
        };
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!disposed) setStatus(error instanceof NaverMapConfigError ? "missing" : "error");
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [attempt]);

  useEffect(() => {
    const resources = resourcesRef.current;
    if (!resources || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const point = new resources.maps.LatLng(latitude, longitude);
    resources.marker.setPosition(point);
    resources.map.setCenter(point);
  }, [latitude, longitude]);

  return (
    <div className="grid gap-2">
      <div ref={containerRef} className="h-80 w-full rounded-lg border bg-muted" aria-label="공연장 위치 지도" />
      {status === "loading" ? (
        <p role="status" className="text-small text-muted-foreground">
          지도를 불러오는 중입니다…
        </p>
      ) : null}
      {status === "missing" ? (
        <p role="status" className="text-small text-muted-foreground">
          {
            "지도 키(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)가 설정되지 않아 지도를 표시할 수 없습니다. 위도·경도를 직접 입력하거나 '위치 찾기'를 사용해 주세요."
          }
        </p>
      ) : null}
      {status === "error" ? (
        <div role="alert" className="grid gap-2">
          <p className="text-small text-destructive">
            지도를 불러오지 못했습니다. 네이버 클라우드 콘솔에 이 사이트 주소가 등록됐는지 확인해 주세요. 위도·경도는 직접 입력할 수
            있습니다.
          </p>
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : null}
      <p className="text-small text-muted-foreground">지도를 클릭하거나 마커를 끌어 위치를 보정할 수 있습니다.</p>
    </div>
  );
}
