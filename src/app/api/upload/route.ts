import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import * as turf from '@turf/helpers';
import clustersKmeans from '@turf/clusters-kmeans';
import convex from '@turf/convex';

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
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Assuming row 1 is header
    const rows = xlsx.utils.sheet_to_json<any>(worksheet);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Empty excel file' }, { status: 400 });
    }

    // Parse valid facilities with GPS
    const validFacilities = rows.filter(r => r['GPS']).map((r, index) => {
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
    const mainZoneName = rows[0]['프로젝트명'] || '업로드된 무장애지도';

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
      
      let polyGeoJson = null;
      if (features.length >= 3) {
        const fc = turf.featureCollection(features);
        const hull = convex(fc);
        if (hull) polyGeoJson = hull.geometry;
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
        polygon: polyGeoJson,
        final_index: 80, // Mock score for now
      });
    }

    // Main zone convex hull
    let mainPolyGeoJson = null;
    if (mainPolygonCoords.length >= 3) {
      const mainFc = turf.featureCollection(mainPolygonCoords.map(c => turf.point(c)));
      const mainHull = convex(mainFc);
      if (mainHull) mainPolyGeoJson = mainHull.geometry;
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
