import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import * as turf from '@turf/helpers';
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

      // Category mapping to match Sidebar.tsx Radar Chart
      let rawCategory = r['카테고리'] || '출입구';
      let mappedCategory = 'S2_출입구';
      if (rawCategory.includes('보행')) mappedCategory = 'S1_보행로';
      else if (rawCategory.includes('출입')) mappedCategory = 'S2_출입구';
      else if (rawCategory.includes('화장실')) mappedCategory = 'S3_화장실';
      else if (rawCategory.includes('엘리베이터') || rawCategory.includes('승강기')) mappedCategory = 'S4_엘리베이터';
      else if (rawCategory.includes('주차')) mappedCategory = 'S5_주차장';

      return {
        id: r['ID'] ? `f_${r['ID']}` : `f_${Date.now()}_${index}`,
        name: r['장소명'] || `알 수 없는 장소 ${index}`,
        lat,
        lng,
        category: mappedCategory,
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

    // GeoJSON Points
    const points = turf.featureCollection(
      validFacilities.map(f => turf.point([f.lng, f.lat], { id: f.id }))
    );

    // No automatic subzones! Subzones will be drawn by user later.
    const subZonesToInsert: any[] = [];
    const facilityToSubZoneMap: Record<string, string | null> = {};
    
    validFacilities.forEach(f => {
      // Leave unassigned (use null to avoid Foreign Key violations if 'unassigned' is not in sub_zones table)
      facilityToSubZoneMap[f.id] = null;
    });

    // Main zone polygon using convex hull for a tight wrap
    let mainPolyGeoJson = null;
    if (points.features.length >= 3) {
      try {
        const hull = convex(points);
        if (hull) {
          mainPolyGeoJson = hull.geometry;
        }
      } catch (e) {
        console.error('Convex hull failed', e);
      }
    }
    
    // Fallback if convex hull fails or < 3 points
    if (!mainPolyGeoJson && points.features.length >= 1) {
      const lats = points.features.map(p => p.geometry.coordinates[1]);
      const lngs = points.features.map(p => p.geometry.coordinates[0]);
      const minLat = Math.min(...lats) - 0.0002;
      const maxLat = Math.max(...lats) + 0.0002;
      const minLng = Math.min(...lngs) - 0.0002;
      const maxLng = Math.max(...lngs) + 0.0002;
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
    if (subZonesToInsert.length > 0) {
      const { error: szErr } = await supabase.from('sub_zones').upsert(subZonesToInsert, { onConflict: 'id' });
      if (szErr) throw new Error(`SubZone Insert Error: ${szErr.message}`);
    }

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
      score: f.score
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
