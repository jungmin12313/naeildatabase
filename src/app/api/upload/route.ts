import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import * as turf from '@turf/helpers';
import clustersKmeans from '@turf/clusters-kmeans';

// Initialize Supabase Client with Service Role Key for backend operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const allRows: any[] = [];
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetRows = xlsx.utils.sheet_to_json<any>(worksheet);
      if (sheetRows && sheetRows.length > 0) {
        allRows.push(...sheetRows);
      }
    });

    if (allRows.length === 0) {
      return NextResponse.json({ error: 'Empty excel file' }, { status: 400 });
    }

    // Parse valid facilities with GPS
    const validFacilities = allRows.filter(r => r['GPS']).map((r, index) => {
      const gpsString = r['GPS'] as string;
      const [latStr, lngStr] = gpsString.split(',').map(s => s.trim());
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      
      return {
        id: `f_${Date.now()}_${index}`,
        name: r['장소명'] || `알 수 없는 장소 ${index}`,
        lat,
        lng,
        category: r['카테고리'] || '일반',
        // Mock scoring logic for now based on Excel columns
        doorWidth: parseFloat(r['문너비']) || 0,
        stepHeight: parseFloat(r['단차']) || 0,
      };
    }).filter(f => !isNaN(f.lat) && !isNaN(f.lng));

    if (validFacilities.length === 0) {
      return NextResponse.json({ error: 'No valid GPS data found in file.' }, { status: 400 });
    }

    // Main Zone
    const mainZoneId = `z_${Date.now()}`;
    const mainZoneName = allRows[0]['프로젝트명'] || '업로드된 무장애지도';

    // GeoJSON Points for clustering
    const points = turf.featureCollection(
      validFacilities.map(f => turf.point([f.lng, f.lat], { id: f.id }))
    );

    // Dynamic K calculation (roughly 1 subzone per 30 facilities, max 10, min 2)
    const k = Math.min(Math.max(Math.ceil(validFacilities.length / 30), 2), 10);

    // K-Means clustering
    const clustered = clustersKmeans(points, { numberOfClusters: k });

    // Group features by cluster
    const clusters: { [key: number]: any[] } = {};
    clustered.features.forEach(feature => {
      const clusterId = feature.properties.cluster;
      if (clusterId !== undefined) {
        if (!clusters[clusterId]) clusters[clusterId] = [];
        clusters[clusterId].push(feature);
      }
    });

    // Prepare Supabase Inserts
    const subZonesToInsert = [];
    const facilityToSubZoneMap: Record<string, string> = {};
    const mainPolygonCoords: any[] = [];

    let clusterIdx = 1;
    for (const [clusterId, features] of Object.entries(clusters)) {
      const subZoneId = `sz_${Date.now()}_${clusterId}`;
      const subZoneName = `${mainZoneName} 세부구역 ${clusterIdx++}`;
      
      const clusterPoints = clustered.features.filter(f => f.properties?.cluster === parseInt(clusterId));
      
      let subZonePoly;
      if (clusterPoints.length >= 1) {
        const lats = clusterPoints.map(p => p.geometry.coordinates[1]);
        const lngs = clusterPoints.map(p => p.geometry.coordinates[0]);
        // Add a tiny buffer to make sure it's a valid polygon even for 1-2 points
        const minLat = Math.min(...lats) - 0.0005;
        const maxLat = Math.max(...lats) + 0.0005;
        const minLng = Math.min(...lngs) - 0.0005;
        const maxLng = Math.max(...lngs) + 0.0005;
        
        subZonePoly = turf.polygon([[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]);
      } else {
        // Fallback dummy polygon
        subZonePoly = turf.polygon([[[0,0], [0,1], [1,1], [1,0], [0,0]]]);
      }

      // Track bounding points for main zone polygon
      features.forEach(f => {
        facilityToSubZoneMap[f.properties.id] = subZoneId;
        mainPolygonCoords.push(f.geometry.coordinates);
      });

      subZonesToInsert.push({
        id: subZoneId,
        zone_id: mainZoneId,
        name: subZoneName,
        polygon: subZonePoly.geometry,
        final_index: 80, // Mock score for now
      });
    }

    // Main zone bounding box
    let mainPolyGeoJson = null;
    if (mainPolygonCoords.length >= 1) {
      const lats = mainPolygonCoords.map(c => c[1]);
      const lngs = mainPolygonCoords.map(c => c[0]);
      const minLat = Math.min(...lats) - 0.001;
      const maxLat = Math.max(...lats) + 0.001;
      const minLng = Math.min(...lngs) - 0.001;
      const maxLng = Math.max(...lngs) + 0.001;
      
      mainPolyGeoJson = turf.polygon([[
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat]
      ]]).geometry;
    }

    const zoneToInsert = {
      id: mainZoneId,
      name: mainZoneName,
      level: '대구역',
      polygon: mainPolyGeoJson,
      final_index: 75, // Mock average score
      color_grade: 'A'
    };

    const facilitiesToInsert = validFacilities.map(f => ({
      id: f.id,
      zone_id: mainZoneId,
      sub_zone_id: facilityToSubZoneMap[f.id],
      name: f.name,
      category: f.category,
      location: { lat: f.lat, lng: f.lng }
    }));

    // 1. Insert Zone
    const { error: zErr } = await supabase.from('zones').insert([zoneToInsert]);
    if (zErr) throw new Error(`Zone Insert Error: ${zErr.message}`);

    // 2. Insert SubZones
    const { error: szErr } = await supabase.from('sub_zones').insert(subZonesToInsert);
    if (szErr) throw new Error(`SubZone Insert Error: ${szErr.message}`);

    // 3. Insert Facilities
    // Break into chunks if too many
    const chunkSize = 100;
    for (let i = 0; i < facilitiesToInsert.length; i += chunkSize) {
      const chunk = facilitiesToInsert.slice(i, i + chunkSize);
      const { error: fErr } = await supabase.from('facilities').insert(chunk);
      if (fErr) throw new Error(`Facility Insert Error: ${fErr.message}`);
    }

    return NextResponse.json({ success: true, mainZoneId });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
