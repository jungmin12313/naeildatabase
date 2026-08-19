'use client';

import { useState, useEffect } from 'react';
import KakaoMap from '@/components/KakaoMap';
import Sidebar from '@/components/Sidebar';
import mockDataRaw from '@/data/mock.json';
import { useAuth } from '@/contexts/AuthContext';
import { isPointInPolygon } from '@/utils/geo';

export type MockData = typeof mockDataRaw;

export default function Home() {
  const [zonesData, setZonesData] = useState<any[]>([]);
  const [facilitiesData, setFacilitiesData] = useState<any[]>([]);
  const [categoryScoresData, setCategoryScoresData] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSubZoneId, setSelectedSubZoneId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTargetZoneId, setDrawingTargetZoneId] = useState<string | null>(null);
  const [drawnPolygon, setDrawnPolygon] = useState<{lat: number, lng: number}[]>([]);
  const [reselectingSubZoneId, setReselectingSubZoneId] = useState<string | null>(null);
  
  const { role, assignedZoneId } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { supabase } = await import('@/utils/supabase');
        
        // Fetch Zones, SubZones, Facilities, and CategoryScores
        const [
          { data: dbZones, error: zErr },
          { data: dbSubZones, error: szErr },
          { data: dbFacilities, error: fErr },
          { data: dbCategoryScores, error: csErr }
        ] = await Promise.all([
          supabase.from('zones').select('*'),
          supabase.from('sub_zones').select('*'),
          supabase.from('facilities').select('*'),
          supabase.from('category_scores').select('*')
        ]);
        
        if (dbZones && dbZones.length > 0 && !zErr && !szErr && !fErr && !csErr) {
          // Format data to match our mock data structure for compatibility
          const formattedZones = dbZones.map((z: any) => ({
            ...z,
            subZones: dbSubZones?.filter((sz: any) => sz.zone_id === z.id) || []
          }));
          
          setZonesData(formattedZones);
          if (dbCategoryScores) setCategoryScoresData(dbCategoryScores);
          if (dbFacilities) {
            const formattedFacilities = dbFacilities.map((f: any) => {
              const fScore = dbCategoryScores?.find((cs: any) => cs.facility_id === f.id)?.score;
              return { ...f, score: fScore !== undefined ? fScore : null };
            });
            setFacilitiesData(formattedFacilities);
          }
          setMounted(true);
          return; // Exit early since we used Supabase
        }
        
        // If we reach here, Supabase is empty or failed, so start with empty arrays
        setZonesData([]);
        setFacilitiesData([]);
        setCategoryScoresData([]);
        setMounted(true);
      } catch (err) {
        setZonesData([]);
        setFacilitiesData([]);
        setCategoryScoresData([]);
        setMounted(true);
      }
    }
    
    fetchData();
  }, []);

  // Sync zonesData to localStorage whenever it changes (only for mock mode, but safe to do always)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('naeil_zonesData', JSON.stringify(zonesData));
    }
  }, [zonesData, mounted]);

  if (!mounted) return null;

  // Apply Role-Based Data Filtering
  const mockData = {
    ...mockDataRaw,
    zones: zonesData,
    facilities: facilitiesData.filter(f => {
      // Admin sees everything
      if (role === 'admin') return true;
      // Official sees their assigned zone's private/public, plus other zones' public
      if (role === 'official') {
        if (f.zone_id === assignedZoneId) return true;
        return f.status === '공개';
      }
      // Viewer sees only public
      return f.status === '공개';
    }),
    categoryScores: categoryScoresData
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
    const allSubZonePolygons = (selectedZone?.subZones || []).map(s => s.polygon.coordinates[0][0].map((coord: number[]) => ({ lat: coord[1], lng: coord[0] })));
    displayFacilities = zoneFacilities.filter(f => {
      if (!f.location) return false;
      const pt = { lat: f.location.lat, lng: f.location.lng };
      return !allSubZonePolygons.some((poly: any) => isPointInPolygon(pt, poly));
    });
  } else if (selectedSubZone) {
    // @ts-ignore
    if (selectedSubZone.polygon) {
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
        />
        {/* Top Header Overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm border border-zinc-200 pointer-events-auto">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">모두의 내일 진단</h1>
            <p className="text-sm text-zinc-500 mt-1">접근성 진단 데이터 지도</p>
          </div>
        </div>
      </div>
      
      <div className="w-[480px] h-full bg-white border-l border-zinc-200 shadow-xl z-20 overflow-y-auto flex flex-col print:w-full print:h-auto print:border-none print:shadow-none print:overflow-visible">
        <Sidebar 
          data={mockData}
          selectedZone={selectedZone}
          zoneFacilities={zoneFacilities}
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
          onSelectZone={(id) => {
            setSelectedZoneId(id);
            setSelectedSubZoneId(null);
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
