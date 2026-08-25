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

      const name = r['장소명'] || '';
      let x1 = parseFloat(r['유효폭']) || parseFloat(r['문너비']) || parseFloat(r['문 너비']) || 0;
      
      // 이상치 정정
      if (name.includes('한라맥주') && x1 > 90) x1 = 0.98;
      else if (name.includes('숨바꼭질') && x1 > 8) x1 = 0.83;
      else if (name.includes('세븐일레븐') && x1 > 8) x1 = 0.81;

      if (x1 > 0 && x1 < 10) x1 *= 100; // convert meters to cm if needed
      
      let x_h = parseFloat(r['가로 너비']) || parseFloat(r['가로너비']) || 0;
      if (x_h > 0 && x_h < 10) x_h *= 100;
      
      let x_v = parseFloat(r['세로 너비']) || parseFloat(r['세로너비']) || 0;
      if (x_v > 0 && x_v < 10) x_v *= 100;
      
      const x2 = parseFloat(r['단차']) || 0;
      // 기울기 값이 비어있거나 0인지 확인하기 위해 원본 값 보존
      const rawIncline = r['기울기'];
      const x3 = parseFloat(rawIncline) || 0;
      
      // 카테고리 매핑
      let rawCategory = r['카테고리'] || '출입구';
      let mappedCategory = 'S2_출입구';
      if (rawCategory.includes('보행')) mappedCategory = 'S1_보행로';
      else if (rawCategory.includes('출입')) mappedCategory = 'S2_출입구';
      else if (rawCategory.includes('화장실')) mappedCategory = 'S3_화장실';
      else if (rawCategory.includes('엘리베이터') || rawCategory.includes('승강기')) mappedCategory = 'S4_엘리베이터';
      else if (rawCategory.includes('주차')) mappedCategory = 'S5_주차장';
      
      // 공통 수식 (단차, 기울기)
      const s_step = Math.min(100, Math.max(0, ((6 - x2) / (6 - 2)) * 100));
      
      // 기울기 점수 (단차가 2cm를 초과하는데 기울기 데이터가 없거나 0이면 위험요소이므로 0점 처리)
      let s_slope = 0;
      if (x2 <= 2) {
        s_slope = 100; // 단차가 2cm 이하 평탄하면 기울기 무관 만점
      } else {
        if (rawIncline === undefined || rawIncline === null || rawIncline === '' || x3 === 0) {
          s_slope = 0; // 결측이거나 0인 경우 0점 (보수적 처리)
        } else {
          s_slope = Math.min(100, Math.max(0, ((14.4 - x3) / (14.4 - 4.8)) * 100));
        }
      }
      
      const s_step_slope = x2 <= 2 ? 100 : (0.5 * s_step + 0.5 * s_slope);

      let fScore = 0;

      // PDF 수식 적용
      if (mappedCategory === 'S1_보행로') {
        const s1 = Math.min(100, Math.max(0, ((x1 - 40) / (120 - 40)) * 100));
        fScore = (1/3) * s1 + (1/3) * s_step + (1/3) * s_slope;
      } 
      else if (mappedCategory === 'S2_출입구') {
        const s_width = Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100));
        fScore = 0.5 * s_width + 0.5 * s_step_slope;
      }
      else if (mappedCategory === 'S3_화장실') {
        const s_width_h = Math.min(100, Math.max(0, ((x_h - 140/3) / (140 - 140/3)) * 100));
        const s_width_v = Math.min(100, Math.max(0, ((x_v - 140/3) / (140 - 140/3)) * 100));
        const s_door = Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100));
        fScore = 0.25 * s_width_h + 0.25 * s_width_v + 0.25 * s_door + 0.25 * s_step_slope;
      }
      else if (mappedCategory === 'S4_엘리베이터') {
        const s_width_h = Math.min(100, Math.max(0, ((x_h - 160/3) / (160 - 160/3)) * 100));
        const s_width_v = Math.min(100, Math.max(0, ((x_v - 45) / (135 - 45)) * 100));
        const s_door = Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100));
        fScore = 0.25 * s_width_h + 0.25 * s_width_v + 0.25 * s_door + 0.25 * s_step_slope;
      }
      else if (mappedCategory === 'S5_주차장') {
        const s_width_h = Math.min(100, Math.max(0, ((x_h - 110) / (330 - 110)) * 100));
        const s_width_v = Math.min(100, Math.max(0, ((x_v - 500/3) / (500 - 500/3)) * 100));
        fScore = 0.5 * s_width_h + 0.5 * s_width_v;
      }

      if (isNaN(fScore)) fScore = 0;

      return {
        id: r['ID'] ? `f_${r['ID']}` : `f_${Date.now()}_${index}`,
        name: r['장소명'] || `알 수 없는 장소 ${index}`,
        lat,
        lng,
        category: mappedCategory,
        doorWidth: x1,
        stepHeight: x2,
        incline: x3,
        score: fScore,
        raw_data: r
      };
    }).filter(f => !isNaN(f.lat) && !isNaN(f.lng));

    if (validFacilities.length === 0) {
      return NextResponse.json({ error: 'No valid GPS data found in file.' }, { status: 400 });
    }

    // Calculate Category Averages
    const zoneTotalAverage = validFacilities.reduce((sum, f) => sum + f.score, 0) / validFacilities.length;
    const catAvgs: Record<string, number> = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 };
    ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'].forEach((cat, index) => {
      const facilitiesInCat = validFacilities.filter(f => f.category === cat);
      catAvgs[`S${index + 1}`] = facilitiesInCat.length > 0
        ? facilitiesInCat.reduce((sum, f) => sum + f.score, 0) / facilitiesInCat.length
        : zoneTotalAverage; // Use zone average for missing categories to avoid crippling the area
    });

    const finalIndexRaw = (
      catAvgs.S1 * catAvgs.S2 +
      catAvgs.S2 * catAvgs.S3 +
      catAvgs.S3 * catAvgs.S4 +
      catAvgs.S4 * catAvgs.S5 +
      catAvgs.S5 * catAvgs.S1
    ) / 500;
    
    const avgScore = Math.round(finalIndexRaw);

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

    const facilitiesToInsert = validFacilities.map(f => {
      const rawPhoto = f.raw_data['사진'] || '';
      const photoUrl = rawPhoto ? (rawPhoto.startsWith('/') ? rawPhoto : `/${rawPhoto}`) : null;
      return {
        id: f.id,
        zone_id: mainZoneId,
        sub_zone_id: facilityToSubZoneMap[f.id],
        name: f.name,
        category: f.category,
        location: { lat: f.lat, lng: f.lng },
        image_url: photoUrl,
        status: '공개'
      };
    });

    // 1. Insert/Upsert Zone
    const { error: zErr } = await supabase.from('zones').upsert([zoneToInsert], { onConflict: 'id' });
    if (zErr) throw new Error(`Zone Insert Error: ${zErr.message}`);

    // 2. Insert/Upsert SubZones
    if (subZonesToInsert.length > 0) {
      const { error: szErr } = await supabase.from('sub_zones').upsert(subZonesToInsert, { onConflict: 'id' });
      if (szErr) throw new Error(`SubZone Insert Error: ${szErr.message}`);
    }

    // 3. Insert/Upsert Facilities
    const chunkSize = 100;
    for (let i = 0; i < facilitiesToInsert.length; i += chunkSize) {
      const chunk = facilitiesToInsert.slice(i, i + chunkSize);
      const { error: fErr } = await supabase.from('facilities').upsert(chunk, { onConflict: 'id' });
      if (fErr) throw new Error(`Facility Insert Error: ${fErr.message}`);
    }

    // 4. Insert/Upsert Category Scores
    const categoryScoresToInsert = validFacilities.map(f => {
      const r = f.raw_data;
      const metrics = {
        유효폭: r['유효폭'] || r['문너비'] || r['문 너비'] || '',
        가로너비: r['가로 너비'] || r['가로너비'] || '',
        세로너비: r['세로 너비'] || r['세로너비'] || '',
        단차: r['단차'] || '',
        기울기: r['기울기'] || '',
        비고: r['기타 특이사항'] || r['비고'] || r['기타사항'] || ''
      };
      
      return {
        id: `cs_${f.id}`,
        facility_id: f.id,
        category: f.category,
        score: f.score,
        reason: JSON.stringify(metrics) // Store raw data here for the frontend to display
      };
    });
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
