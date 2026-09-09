'use client';

import { useState, useEffect } from 'react';
import KakaoMap from '@/components/KakaoMap';
import Sidebar from '@/components/Sidebar';
import mockDataRaw from '@/data/mock.json';
import FacilityDetail from '@/components/FacilityDetail';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isPointInPolygon } from '@/utils/geo';
import { useDashboardData } from '@/hooks/useDashboardData';

export type MockData = typeof mockDataRaw;

export default function Home() {
  const { mockData: fetchedMockData, dataLoaded, setZonesData } = useDashboardData();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSubZoneId, setSelectedSubZoneId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTargetZoneId, setDrawingTargetZoneId] = useState<string | null>(null);
  const [drawnPolygon, setDrawnPolygon] = useState<{lat: number, lng: number}[]>([]);
  const [reselectingSubZoneId, setReselectingSubZoneId] = useState<string | null>(null);
  
  const { role, assignedZoneId } = useAuth();
  
  // Sync zonesData to localStorage whenever it changes
  useEffect(() => {
    if (dataLoaded && fetchedMockData.zones) {
      localStorage.setItem('naeil_zonesData', JSON.stringify(fetchedMockData.zones));
    }
  }, [fetchedMockData.zones, dataLoaded]);

  if (!dataLoaded) return null;

  // Apply Role-Based Data Filtering
  // Apply Role-Based Data Filtering
  const mockData = {
    ...fetchedMockData,
    facilities: fetchedMockData.facilities.filter(f => {
      const fStatus = f.status || '공개';
      // Admin sees everything
      if (role === 'admin') return true;
      // Official sees their assigned zone's private/public, plus other zones' public
      if (role === 'official') {
        if (f.zone_id === assignedZoneId) return true;
        return fStatus === '공개';
      }
      // Viewer sees only public
      return fStatus === '공개';
    })
  };

  const selectedZone = mockData.zones.find(z => z.id === selectedZoneId) || null;
  const zoneFacilities = selectedZone 
    ? mockData.facilities.filter(f => f.zone_id === selectedZone.id) 
    : [];

  const selectedFacility = mockData.facilities.find(f => f.id === selectedFacilityId) || null;

  // Calculate displayFacilities (lifting up from Sidebar)
  // @ts-ignore
  const selectedSubZone = selectedZone?.subZones?.find((s: any) => s.id === selectedSubZoneId) || null;
  
  let displayFacilities = zoneFacilities;
  if (selectedSubZoneId === 'unassigned') {
    // @ts-ignore
    const allSubZonePolygons = (selectedZone?.subZones || [])
      .filter((s: any) => s?.polygon?.coordinates?.[0]?.[0])
      .map((s: any) => s.polygon.coordinates[0][0].map((coord: number[]) => ({ lat: coord[1], lng: coord[0] })));
    displayFacilities = zoneFacilities.filter(f => {
      if (!f.location) return false;
      const pt = { lat: f.location.lat, lng: f.location.lng };
      return !allSubZonePolygons.some((poly: any) => isPointInPolygon(pt, poly));
    });
  } else if (selectedSubZone) {
    // @ts-ignore
    if (selectedSubZone?.polygon?.coordinates?.[0]?.[0]) {
      // @ts-ignore
      const poly = selectedSubZone.polygon.coordinates[0][0].map((coord: number[]) => ({ lat: coord[1], lng: coord[0] }));
      displayFacilities = zoneFacilities.filter(f => f.location && isPointInPolygon({ lat: f.location.lat, lng: f.location.lng }, poly));
    } else {
      // If polygon is missing but we have sub_zone_id matching (like from DB)
      // @ts-ignore
      displayFacilities = zoneFacilities.filter(f => f.sub_zone_id === selectedSubZoneId);
    }
  }

  return (
    <main className="flex h-screen w-full overflow-hidden bg-zinc-50 print:block print:h-auto print:overflow-visible">
      {/* Left Sidebar for Facility Details */}
      {selectedFacility && (
        <div className="absolute md:relative bottom-0 left-0 w-full md:w-[440px] h-[60vh] md:h-full bg-white border-t md:border-t-0 md:border-r border-zinc-200 shadow-2xl md:shadow-xl z-40 flex flex-col animate-in slide-in-from-bottom md:slide-in-from-left print:hidden overflow-hidden">
          <div className="absolute top-4 right-4 z-50">
            <button 
              onClick={() => setSelectedFacilityId(null)}
              className="p-2 bg-white rounded-full shadow-md border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto h-full flex-1 w-full">
            <FacilityDetail 
              facility={selectedFacility} 
              measurements={mockData.measurements.filter(m => m.facility_id === selectedFacility.id)}
              scores={mockData.categoryScores.filter(s => s.facility_id === selectedFacility.id)}
              texts={mockData.diagnosisTexts.filter(t => t.facility_id === selectedFacility.id)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 relative h-full print:hidden">
        <KakaoMap 
          zones={mockData.zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={(id) => {
            if (isDrawingMode) return;
            setSelectedZoneId(id);
            setSelectedSubZoneId(null);
            setSelectedFacilityId(null);
          }}
          selectedSubZoneId={selectedSubZoneId}
          onSelectSubZone={(id) => {
            if (isDrawingMode) return;
            setSelectedSubZoneId(id);
            setSelectedFacilityId(null);
          }}
          isDrawingMode={isDrawingMode}
          drawnPolygon={drawnPolygon}
          setDrawnPolygon={setDrawnPolygon}
          drawingTargetZoneId={drawingTargetZoneId}
          reselectingSubZoneId={reselectingSubZoneId}
          displayFacilities={displayFacilities}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={setSelectedFacilityId}
        />
        {/* Top Header Overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm border border-zinc-200 pointer-events-auto">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">모두의 내일 진단</h1>
            <p className="text-sm text-zinc-500 mt-1">접근성 진단 데이터 지도</p>
          </div>
        </div>
      </div>
      
      <div className="absolute md:relative bottom-0 right-0 w-full md:w-[480px] h-[50vh] md:h-full bg-white border-t md:border-t-0 md:border-l border-zinc-200 shadow-2xl md:shadow-xl z-30 flex flex-col print:w-full print:h-auto print:border-none print:shadow-none print:overflow-visible transition-transform">
        <Sidebar 
          data={mockData}
          selectedZone={selectedZone}
          zoneFacilities={zoneFacilities}
          displayFacilities={displayFacilities}
          selectedFacility={selectedFacility}
          onSelectFacility={setSelectedFacilityId}
          onBackToZones={() => {
            setSelectedZoneId(null);
            setSelectedSubZoneId(null);
            setSelectedFacilityId(null);
          }}
          onBackToZone={() => {
            setSelectedSubZoneId(null);
            setSelectedFacilityId(null);
          }}
          onSelectZone={(zoneId, subZoneId) => {
            setSelectedZoneId(zoneId);
            if (subZoneId) {
              setSelectedSubZoneId(subZoneId);
            } else {
              setSelectedSubZoneId(null);
            }
            setSelectedFacilityId(null);
          }}
          selectedSubZoneId={selectedSubZoneId}
          onSelectSubZone={setSelectedSubZoneId}
          onUpdateZones={setZonesData}
          isDrawingMode={isDrawingMode}
          setIsDrawingMode={setIsDrawingMode}
          drawingTargetZoneId={drawingTargetZoneId}
          setDrawingTargetZoneId={setDrawingTargetZoneId}
          drawnPolygon={drawnPolygon}
          setDrawnPolygon={setDrawnPolygon}
        />
      </div>
    </main>
  );
}
