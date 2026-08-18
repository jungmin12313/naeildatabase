'use client';

import { useEffect, useState, useRef } from 'react';
import { Map, Polygon, CustomOverlayMap } from 'react-kakao-maps-sdk';
import { getColorForGrade, getColorForScore } from '@/constants/colors';

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
  isDrawingMode?: boolean;
  drawnPolygon?: {lat: number, lng: number}[];
  setDrawnPolygon?: (polygon: {lat: number, lng: number}[]) => void;
  drawingTargetZoneId?: string | null;
  selectedSubZoneId?: string | null;
  onSelectSubZone?: (id: string) => void;
  reselectingSubZoneId?: string | null;
  displayFacilities?: any[];
}

export default function KakaoMap({ 
  zones, 
  selectedZoneId, 
  onSelectZone,
  isDrawingMode,
  drawnPolygon,
  setDrawnPolygon,
  drawingTargetZoneId,
  selectedSubZoneId,
  onSelectSubZone,
  reselectingSubZoneId,
  displayFacilities
}: KakaoMapProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [kakaoError, setKakaoError] = useState(false);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    // If it's already loaded
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => {
        setScriptLoaded(true);
        isLoadedRef.current = true;
      });
      return;
    }

    // Otherwise wait for it
    const checkKakao = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setScriptLoaded(true);
          isLoadedRef.current = true;
        });
        clearInterval(checkKakao);
      }
    }, 100);

    const timeout = setTimeout(() => {
      if (!isLoadedRef.current) {
        setKakaoError(true);
        clearInterval(checkKakao);
      }
    }, 5000);

    return () => {
      clearInterval(checkKakao);
      clearTimeout(timeout);
    };
  }, []);

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

  const handleMapClick = (_t: any, mouseEvent: any) => {
    if (isDrawingMode && setDrawnPolygon && drawnPolygon) {
      setDrawnPolygon([
        ...drawnPolygon,
        { lat: mouseEvent.latLng.getLat(), lng: mouseEvent.latLng.getLng() }
      ]);
    }
  };

  return (
    <div className="relative w-full h-full">
      {isDrawingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-pulse">
          지도에 클릭하여 다각형의 꼭짓점을 찍어주세요
        </div>
      )}
      <Map
        center={defaultCenter}
        style={{ width: '100%', height: '100%', cursor: isDrawingMode ? 'crosshair' : 'default' }}
        level={5}
        onClick={handleMapClick}
      >
        {isDrawingMode && drawnPolygon && drawnPolygon.length > 0 && (
          <Polygon
            path={drawnPolygon}
            strokeWeight={3}
            strokeColor={'#db4040'}
            strokeOpacity={0.8}
            strokeStyle={'solid'}
            fillColor={'#db4040'}
            fillOpacity={0.4}
          />
        )}
        {isDrawingMode && drawnPolygon && drawnPolygon.map((pos, idx) => (
          <CustomOverlayMap key={idx} position={pos}>
            <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2" />
          </CustomOverlayMap>
        ))}

      {zones.map((zone) => {
        if (!zone.polygon || !zone.polygon.coordinates || zone.polygon.coordinates.length === 0) return null;
        
        // PostGIS Polygon format: [[[lng, lat], [lng, lat], ...]]
        // Kakao Polygon expects: [{lat, lng}, {lat, lng}, ...]
        const path = zone.polygon.coordinates[0].map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        }));
        
        const score = zone.final_index as number | null;
        const mainColor = getColorForScore(score);
        const isSelected = selectedZoneId === zone.id;

        // Calculate center for label (rough approximation)
        const centerLat = path.reduce((sum: number, p: any) => sum + p.lat, 0) / path.length;
        const centerLng = path.reduce((sum: number, p: any) => sum + p.lng, 0) / path.length;

        return (
          <div key={zone.id}>
            <Polygon
              path={path}
              strokeWeight={isSelected ? (selectedSubZoneId === 'unassigned' ? 4 : 3) : 2}
              strokeColor={isSelected ? (selectedSubZoneId === 'unassigned' ? '#4b5563' : '#3b82f6') : '#71717a'}
              strokeOpacity={0.8}
              strokeStyle={isSelected ? 'solid' : 'dashed'}
              fillColor={isSelected ? (selectedSubZoneId === 'unassigned' ? '#9ca3af' : mainColor) : mainColor}
              fillOpacity={isSelected ? (selectedSubZoneId === 'unassigned' ? 0.3 : 0.6) : 0.4}
              onClick={() => onSelectZone(zone.id)}
            />
            {!selectedZoneId && (
              <CustomOverlayMap position={{ lat: centerLat, lng: centerLng }}>
                <div 
                  className={`px-3 py-1.5 rounded-lg shadow-sm border font-medium text-sm whitespace-nowrap cursor-pointer transition-all flex items-center
                    ${isSelected ? 'bg-blue-600 text-white border-blue-700 shadow-md transform scale-105' : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400'}`}
                  onClick={() => onSelectZone(zone.id)}
                >
                  {zone.name}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {score !== null ? `${score.toFixed(1)}점` : '산출보류'}
                  </span>
                </div>
              </CustomOverlayMap>
            )}

            {/* Render subzones if this zone is selected OR if it is being drawn on */}
            {(isSelected || (isDrawingMode && drawingTargetZoneId === zone.id)) && (zone as any).subZones && (zone as any).subZones.map((sub: any) => {
              if (!sub.polygon || !sub.polygon.coordinates || sub.polygon.coordinates.length === 0) return null;
              
              const subPath = sub.polygon.coordinates[0][0].map((coord: number[]) => ({
                lat: coord[1],
                lng: coord[0]
              }));
              
              const subScore = sub.final_index as number | null;
              const subColor = getColorForScore(subScore);
              
              const subCenterLat = subPath.reduce((sum: number, p: any) => sum + p.lat, 0) / subPath.length;
              const subCenterLng = subPath.reduce((sum: number, p: any) => sum + p.lng, 0) / subPath.length;

              const isSubSelected = selectedSubZoneId === sub.id;
              const isReselecting = reselectingSubZoneId === sub.id;

              return (
                <div key={sub.id}>
                  <Polygon
                    path={subPath}
                    strokeWeight={isSubSelected ? 5 : (isReselecting ? 4 : 3)}
                    strokeColor={isSubSelected ? '#ef4444' : (isReselecting ? '#ef4444' : '#2563eb')}
                    strokeOpacity={isSubSelected ? 1 : (isReselecting ? 0.8 : 0.8)}
                    fillColor={subColor}
                    fillOpacity={isReselecting ? 0.1 : (isSubSelected ? 0.9 : 0.7)}
                    strokeStyle={isSubSelected ? 'solid' : (isReselecting ? 'longdash' : 'dashed')}
                    onClick={() => onSelectSubZone && onSelectSubZone(sub.id)}
                  />
                  {!isReselecting && (
                    <CustomOverlayMap position={{ lat: subCenterLat, lng: subCenterLng }}>
                      <div 
                        className={`px-2 py-1 backdrop-blur-sm rounded-md shadow border text-xs font-bold flex flex-col items-center cursor-pointer transition-transform ${isSubSelected ? 'bg-red-50 text-red-700 border-red-500 scale-110 z-10' : 'bg-white/90 text-zinc-800 border-zinc-200 hover:scale-105'}`}
                        onClick={() => onSelectSubZone && onSelectSubZone(sub.id)}
                      >
                        <span>{sub.name}</span>
                        <span style={{ color: isSubSelected ? '#ef4444' : subColor }}>{subScore !== null ? `${subScore.toFixed(1)}점` : '-'}</span>
                      </div>
                    </CustomOverlayMap>
                  )}
                </div>
              );
            })}

            {/* Facility Markers (e.g. Unassigned) */}
            {selectedSubZoneId === 'unassigned' && displayFacilities && displayFacilities.map(f => {
              if (!f.location) return null;
              return (
                <CustomOverlayMap key={`marker-${f.id}`} position={f.location}>
                  <div className="group relative cursor-pointer">
                    <div className="w-4 h-4 bg-zinc-600 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg z-20">
                      {f.name}
                    </div>
                  </div>
                </CustomOverlayMap>
              );
            })}
          </div>
        );
      })}
    </Map>
    </div>
  );
}
