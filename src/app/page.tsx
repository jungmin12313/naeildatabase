'use client';

import { useState, useEffect } from 'react';
import KakaoMap from '@/components/KakaoMap';
import Sidebar from '@/components/Sidebar';
import mockDataRaw from '@/data/mock.json';
import { useAuth } from '@/contexts/AuthContext';

export type MockData = typeof mockDataRaw;

export default function Home() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  
  const { role, assignedZoneId } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Apply Role-Based Data Filtering
  const mockData = {
    ...mockDataRaw,
    facilities: mockDataRaw.facilities.filter(f => {
      // Admin sees everything
      if (role === 'admin') return true;
      // Official sees their assigned zone's private/public, plus other zones' public
      if (role === 'official') {
        if (f.zone_id === assignedZoneId) return true;
        return f.status === '공개';
      }
      // Viewer sees only public
      return f.status === '공개';
    })
  };

  const selectedZone = mockData.zones.find(z => z.id === selectedZoneId) || null;
  const zoneFacilities = selectedZone 
    ? mockData.facilities.filter(f => f.zone_id === selectedZone.id) 
    : [];

  const selectedFacility = mockData.facilities.find(f => f.id === selectedFacilityId) || null;

  return (
    <main className="flex h-screen w-full overflow-hidden bg-zinc-50 print:block print:h-auto print:overflow-visible">
      <div className="flex-1 relative h-full print:hidden">
        <KakaoMap 
          zones={mockData.zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={(id) => {
            setSelectedZoneId(id);
            setSelectedFacilityId(null);
          }}
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
            setSelectedFacilityId(null);
          }}
          onBackToZone={() => setSelectedFacilityId(null)}
          onSelectZone={(id) => {
            setSelectedZoneId(id);
            setSelectedFacilityId(null);
          }}
        />
      </div>
    </main>
  );
}
