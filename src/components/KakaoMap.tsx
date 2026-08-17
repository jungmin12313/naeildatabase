'use client';

import { useEffect, useState } from 'react';
import { Map, Polygon, CustomOverlayMap } from 'react-kakao-maps-sdk';
import { getColorForGrade } from '@/constants/colors';

declare global {
  interface Window {
    kakao: any;
  }
}

interface Zone {
  id: string;
  name: string;
  polygon: any;
  final_index: number | null;
  color_grade: string;
}

interface KakaoMapProps {
  zones: Zone[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export default function KakaoMap({ zones, selectedZoneId, onSelectZone }: KakaoMapProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [kakaoError, setKakaoError] = useState(false);

  useEffect(() => {
    // Wait for the script to load via Next.js <Script> in layout
    const checkKakao = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setScriptLoaded(true);
        });
        clearInterval(checkKakao);
      }
    }, 100);

    // Timeout after 5s if Kakao fails to load (e.g. no valid key)
    const timeout = setTimeout(() => {
      if (!scriptLoaded) {
        setKakaoError(true);
        clearInterval(checkKakao);
      }
    }, 5000);

    return () => {
      clearInterval(checkKakao);
      clearTimeout(timeout);
    };
  }, [scriptLoaded]);

  // Center on Gwangju (where the data '전대후문' is)
  const defaultCenter = { lat: 35.176, lng: 126.912 };

  if (kakaoError || (!scriptLoaded && process.env.NEXT_PUBLIC_KAKAO_MAP_KEY === 'PLACEHOLDER')) {
    return (
      <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-zinc-200 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-zinc-900">지도 로드 대기 중</h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">
          현재 카카오맵 API 키가 설정되지 않았거나 유효하지 않습니다. <br />
          <code className="text-xs bg-zinc-200 px-1 py-0.5 rounded mt-2 inline-block">.env.local</code> 파일에 키를 입력해주세요.
        </p>
        
        {/* Placeholder UI for testing without map */}
        <div className="mt-8 grid grid-cols-1 gap-3 w-full max-w-sm">
          {zones.map(z => (
            <button 
              key={z.id}
              onClick={() => onSelectZone(z.id)}
              className={`p-4 rounded-xl border text-left transition-colors ${selectedZoneId === z.id ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
            >
              <div className="font-medium text-zinc-900">{z.name}</div>
              <div className="text-sm text-zinc-500 flex items-center mt-1">
                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getColorForGrade(z.color_grade).fill }} />
                지수: {z.final_index ? z.final_index.toFixed(1) : '산출보류'}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!scriptLoaded) {
    return <div className="w-full h-full bg-zinc-100 animate-pulse" />;
  }

  return (
    <Map
      center={defaultCenter}
      style={{ width: '100%', height: '100%' }}
      level={5}
    >
      {zones.map((zone) => {
        if (!zone.polygon || !zone.polygon.coordinates || zone.polygon.coordinates.length === 0) return null;
        
        // PostGIS Polygon format: [[[lng, lat], [lng, lat], ...]]
        // Kakao Polygon expects: [{lat, lng}, {lat, lng}, ...]
        const path = zone.polygon.coordinates[0].map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        }));
        
        const color = getColorForGrade(zone.color_grade);
        const isSelected = selectedZoneId === zone.id;

        // Calculate center for label (rough approximation)
        const centerLat = path.reduce((sum: number, p: any) => sum + p.lat, 0) / path.length;
        const centerLng = path.reduce((sum: number, p: any) => sum + p.lng, 0) / path.length;

        return (
          <div key={zone.id}>
            <Polygon
              path={path}
              strokeWeight={isSelected ? 4 : 2}
              strokeColor={isSelected ? '#3b82f6' : color.stroke}
              strokeOpacity={0.8}
              fillColor={color.fill}
              fillOpacity={isSelected ? 0.6 : 0.4}
              onClick={() => onSelectZone(zone.id)}
            />
            {(!selectedZoneId || isSelected) && (
              <CustomOverlayMap position={{ lat: centerLat, lng: centerLng }}>
                <div 
                  className={`px-3 py-1.5 rounded-lg shadow-sm border font-medium text-sm whitespace-nowrap cursor-pointer transition-all
                    ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-md transform scale-105' : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400'}`}
                  onClick={() => onSelectZone(zone.id)}
                >
                  {zone.name}
                  {isSelected && <span className="ml-1 opacity-80 text-xs">선택됨</span>}
                </div>
              </CustomOverlayMap>
            )}
          </div>
        );
      })}
    </Map>
  );
}
