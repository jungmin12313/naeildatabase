import { useState, useEffect, useMemo } from 'react';
import mockDataRaw from '@/data/mock.json';

export function useDashboardData() {
  // Initialize immediately with full mock data so there is ZERO black screen / delay
  const [zonesData, setZonesData] = useState<any[]>(mockDataRaw.zones || []);
  const [facilitiesData, setFacilitiesData] = useState<any[]>(mockDataRaw.facilities || []);
  const [categoryScoresData, setCategoryScoresData] = useState<any[]>(mockDataRaw.categoryScores || []);
  const [dataLoaded, setDataLoaded] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Check local storage override first
        const localZones = localStorage.getItem('naeil_zonesData');
        if (localZones) {
          try {
            const parsed = JSON.parse(localZones);
            if (
              Array.isArray(parsed) && 
              parsed.length > 0 && 
              parsed[0]?.id !== 'z_dummy_loading' &&
              (parsed[0]?.id === mockDataRaw.zones[0]?.id || parsed[0]?.name?.includes('전대후문'))
            ) {
              setZonesData(parsed);
            } else {
              localStorage.removeItem('naeil_zonesData');
              setZonesData(mockDataRaw.zones);
            }
          } catch(e) { }
        }

        // Try Supabase if available
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
          if (dbCategoryScores && dbCategoryScores.length > 0) setCategoryScoresData(dbCategoryScores);
          if (dbFacilities && dbFacilities.length > 0) {
            const formattedFacilities = dbFacilities.map((f: any) => {
              const fScore = dbCategoryScores?.find((cs: any) => cs.facility_id === f.id)?.score;
              return { ...f, score: fScore !== undefined ? fScore : null };
            });
            setFacilitiesData(formattedFacilities);
          }
        }
      } catch (err) {
        // Fallback: full mockDataRaw is already loaded as default state
      } finally {
        setDataLoaded(true);
      }
    }
    
    fetchData();
  }, []);

  const mockData = useMemo(() => {
    return {
      ...mockDataRaw,
      zones: zonesData.length > 0 ? zonesData : mockDataRaw.zones,
      facilities: facilitiesData.length > 0 ? facilitiesData : mockDataRaw.facilities,
      categoryScores: categoryScoresData.length > 0 ? categoryScoresData : mockDataRaw.categoryScores
    };
  }, [zonesData, facilitiesData, categoryScoresData]);

  return { mockData, dataLoaded, setZonesData };
}
