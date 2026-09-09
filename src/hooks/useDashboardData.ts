import { useState, useEffect, useMemo } from 'react';
import mockDataRaw from '@/data/mock.json';

export function useDashboardData() {
  const [zonesData, setZonesData] = useState<any[]>([]);
  const [facilitiesData, setFacilitiesData] = useState<any[]>([]);
  const [categoryScoresData, setCategoryScoresData] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { supabase } = await import('@/utils/supabase');
        
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
          setDataLoaded(true);
          return;
        }
        
        // Fallback to local storage
        const localZones = localStorage.getItem('naeil_zonesData');
        if (localZones) {
          try { setZonesData(JSON.parse(localZones)); } catch(e) { }
        }
        setDataLoaded(true);
      } catch (err) {
        const localZones = localStorage.getItem('naeil_zonesData');
        if (localZones) {
          try { setZonesData(JSON.parse(localZones)); } catch(e) { }
        }
        setDataLoaded(true);
      }
    }
    
    fetchData();
  }, []);

  const mockData = useMemo(() => {
    if (!dataLoaded) {
      return mockDataRaw; // Show fallback while loading
    }
    return {
      ...mockDataRaw,
      zones: zonesData,
      facilities: facilitiesData,
      categoryScores: categoryScoresData
    };
  }, [zonesData, facilitiesData, categoryScoresData, dataLoaded]);

  return { mockData, dataLoaded, setZonesData };
}
