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

      let x1 = parseFloat(r['유효폭']) || parseFloat(r['문너비']) || 0;
      if (x1 > 0 && x1 < 10) x1 *= 100; // convert meters to cm if needed
      
      const x2 = parseFloat(r['단차']) || 0;
      const x3 = parseFloat(r['기울기']) || 0;
      
      // 출입구(S2) 산출 공식 적용
      const s_width = Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100));
      const s_step = Math.min(100, Math.max(0, ((6 - x2) / (6 - 2)) * 100));
      const s_slope = Math.min(100, Math.max(0, ((14.4 - x3) / (14.4 - 4.8)) * 100));
      
      let s_step_slope;
      if (x2 <= 2) {
        s_step_slope = 100;
      } else {
        s_step_slope = 0.5 * s_step + 0.5 * s_slope;
      }
      
      let fScore = 0.5 * s_width + 0.5 * s_step_slope;
      if (isNaN(fScore)) fScore = 0;

      return {
        id: r['ID'] ? `f_${r['ID']}` : `f_${Date.now()}_${index}`,
        name: r['장소명'] || `알 수 없는 장소 ${index}`,
        lat,
        lng,
        category: r['카테고리'] || '일반',
        doorWidth: x1,
        stepHeight: x2,
        incline: x3,
        score: fScore
      };
    }).filter(f => !isNaN(f.lat) && !isNaN(f.lng));

    if (validFacilities.length === 0) {
      return NextResponse.json({ error: 'No valid GPS data found in file.' }, { status: 400 });
    }

    const avgScore = validFacilities.length > 0 
      ? Math.round(validFacilities.reduce((sum, f) => sum + f.score, 0) / validFacilities.length)
      : 75;

    // Main Zone
    const mainZoneName = allRows[0]['프로젝트명'] || '업로드된 무장애지도';
    const safeName = mainZoneName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const mainZoneId = safeName ? `z_${safeName}` : `z_${Date.now()}`;

    // GeoJSON Points for clustering
    const points = turf.featureCollection(
      validFacilities.map(f => turf.point([f.lng, f.lat], { id: f.id }))
    );

    // ---------------------------------------------------------
    // No more K-Means Clustering! Just one sub-zone for everything
    // ---------------------------------------------------------
    const subZonesToInsert = [];
    const facilityToSubZoneMap: Record<string, string> = {};
    const mainPolygonCoords: any[] = [];

    const subZoneId = `sz_${safeName || Date.now()}_single`;
    const subZoneName = `${mainZoneName} (전체)`;

    let subZonePoly;
    if (points.features.length >= 1) {
      const lats = points.features.map(p => p.geometry.coordinates[1]);
      const lngs = points.features.map(p => p.geometry.coordinates[0]);
      
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
      subZonePoly = turf.polygon([[[0,0], [0,1], [1,1], [1,0], [0,0]]]);
    }

    points.features.forEach(f => {
      // safely get id from feature properties, fallback to a random id if missing
      const fId = f.properties?.id || `f_${Date.now()}_${Math.random()}`;
      facilityToSubZoneMap[fId] = subZoneId;
      mainPolygonCoords.push(f.geometry.coordinates);
    });

    subZonesToInsert.push({
      id: subZoneId,
      zone_id: mainZoneId,
      name: subZoneName,
      polygon: subZonePoly.geometry,
      final_index: avgScore, // Real calculated score
    });

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
      final_index: avgScore, // Real calculated score
      color_grade: avgScore >= 90 ? 'A' : avgScore >= 70 ? 'B' : 'C'
    };

    const facilitiesToInsert = validFacilities.map(f => ({
      id: f.id,
      zone_id: mainZoneId,
      sub_zone_id: facilityToSubZoneMap[f.id],
      name: f.name,
      category: f.category,
      location: { lat: f.lat, lng: f.lng }
    }));

    // 1. Insert/Upsert Zone
    const { error: zErr } = await supabase.from('zones').upsert([zoneToInsert], { onConflict: 'id' });
    if (zErr) throw new Error(`Zone Insert Error: ${zErr.message}`);

    // 2. Insert/Upsert SubZones
    const { error: szErr } = await supabase.from('sub_zones').upsert(subZonesToInsert, { onConflict: 'id' });
    if (szErr) throw new Error(`SubZone Insert Error: ${szErr.message}`);

    // 3. Insert/Upsert Facilities
    // Break into chunks if too many
    const chunkSize = 100;
    for (let i = 0; i < facilitiesToInsert.length; i += chunkSize) {
      const chunk = facilitiesToInsert.slice(i, i + chunkSize);
      const { error: fErr } = await supabase.from('facilities').upsert(chunk, { onConflict: 'id' });
      if (fErr) throw new Error(`Facility Insert Error: ${fErr.message}`);
    }

    // 4. Insert/Upsert Category Scores
    const categoryScoresToInsert = validFacilities.map(f => ({
      id: `cs_${f.id}`,
      facility_id: f.id,
      category: f.category,
      score: f.score,
      status: '계산완료'
    }));
    for (let i = 0; i < categoryScoresToInsert.length; i += chunkSize) {
      const chunk = categoryScoresToInsert.slice(i, i + chunkSize);
      const { error: csErr } = await supabase.from('category_scores').upsert(chunk, { onConflict: 'id' });
      if (csErr) console.error(`Category Score Insert Error: ${csErr.message}`); // non-fatal
    }

    return NextResponse.json({ success: true, mainZoneId });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Delete all zones, sub_zones, and facilities
    // Supabase allows deleting with a wide filter
    await supabase.from('facilities').delete().neq('id', 'dummy');
    await supabase.from('sub_zones').delete().neq('id', 'dummy');
    await supabase.from('zones').delete().neq('id', 'dummy');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
