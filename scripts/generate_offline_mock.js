const fs = require('fs');
const xlsx = require('xlsx');
const turf = require('@turf/helpers');
const convex = require('@turf/convex').default || require('@turf/convex');

const workbook = xlsx.readFile('내일 현장답사.xlsx');
const allRows = [];
workbook.SheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  const sheetRows = xlsx.utils.sheet_to_json(worksheet);
  if (sheetRows && sheetRows.length > 0) {
    allRows.push(...sheetRows);
  }
});

console.log('Total rows in excel:', allRows.length);

const validFacilities = allRows.filter(r => r['GPS']).map((r, index) => {
  const gpsString = r['GPS'];
  const [latStr, lngStr] = gpsString.split(',').map(s => s.trim());
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  const name = r['장소명'] || '';
  const rawX1 = r['유효폭'] ?? r['문너비'] ?? r['문 너비'];
  const hasX1 = rawX1 !== undefined && rawX1 !== null && rawX1 !== '';
  let x1 = hasX1 ? parseFloat(rawX1) : null;
  if (x1 !== null) {
    if (name.includes('한라맥주') && x1 > 90) x1 = 0.98;
    else if (name.includes('숨바꼭질') && x1 > 8) x1 = 0.83;
    else if (name.includes('세븐일레븐') && x1 > 8) x1 = 0.81;
    if (x1 > 0 && x1 < 10) x1 *= 100;
  }
  
  const rawXH = r['가로 너비'] ?? r['가로너비'];
  const hasXH = rawXH !== undefined && rawXH !== null && rawXH !== '';
  let x_h = hasXH ? parseFloat(rawXH) : null;
  if (x_h !== null && x_h > 0 && x_h < 10) x_h *= 100;
  
  const rawXV = r['세로 너비'] ?? r['세로너비'];
  const hasXV = rawXV !== undefined && rawXV !== null && rawXV !== '';
  let x_v = hasXV ? parseFloat(rawXV) : null;
  if (x_v !== null && x_v > 0 && x_v < 10) x_v *= 100;
  
  const rawX2 = r['단차'];
  const hasX2 = rawX2 !== undefined && rawX2 !== null && rawX2 !== '';
  const x2 = hasX2 ? parseFloat(rawX2) : null;

  const rawIncline = r['기울기'];
  const hasIncline = rawIncline !== undefined && rawIncline !== null && rawIncline !== '';
  const x3 = hasIncline ? parseFloat(rawIncline) : null;
  
  // 카테고리 매핑
  let rawCategory = r['카테고리'] || '출입구';
  let mappedCategory = 'S2_출입구';
  if (rawCategory.includes('보행')) mappedCategory = 'S1_보행로';
  else if (rawCategory.includes('출입')) mappedCategory = 'S2_출입구';
  else if (rawCategory.includes('화장실')) mappedCategory = 'S3_화장실';
  else if (rawCategory.includes('엘리베이터') || rawCategory.includes('승강기')) mappedCategory = 'S4_엘리베이터';
  else if (rawCategory.includes('주차')) mappedCategory = 'S5_주차장';
  
  // 공통 수식 (단차, 기울기)
  let s_step = null;
  if (x2 !== null) {
    s_step = Math.min(100, Math.max(0, ((6 - x2) / (6 - 2)) * 100));
  }
  
  let s_slope = null;
  if (x2 !== null && x2 <= 2) {
    if (hasIncline && x3 !== null) {
      s_slope = Math.min(100, Math.max(0, ((14.4 - x3) / (14.4 - 4.8)) * 100));
    } else {
      s_slope = 100;
    }
  } else {
    if (hasIncline && x3 !== null) {
      s_slope = Math.min(100, Math.max(0, ((14.4 - x3) / (14.4 - 4.8)) * 100));
    }
  }
  
  let s_step_slope = null;
  if (s_step !== null && s_slope !== null) {
    s_step_slope = (x2 !== null && x2 <= 2 && !hasIncline) ? 100 : (0.5 * s_step + 0.5 * s_slope);
  } else if (s_step !== null) {
    s_step_slope = (x2 !== null && x2 <= 2) ? 100 : s_step;
  } else if (s_slope !== null) {
    s_step_slope = s_slope;
  }

  const scoresToAverage = [];
  const addScore = (val) => { if (val !== null && !isNaN(val)) scoresToAverage.push(val); };

  if (mappedCategory === 'S1_보행로') {
    const s1 = x1 !== null ? Math.min(100, Math.max(0, ((x1 - 40) / (120 - 40)) * 100)) : null;
    addScore(s1); addScore(s_step); addScore(s_slope);
  } else if (mappedCategory === 'S2_출입구') {
    const s_width = x1 !== null ? Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100)) : null;
    addScore(s_width); addScore(s_step_slope);
  } else if (mappedCategory === 'S3_화장실') {
    const s_width_h = x_h !== null ? Math.min(100, Math.max(0, ((x_h - 140/3) / (140 - 140/3)) * 100)) : null;
    const s_width_v = x_v !== null ? Math.min(100, Math.max(0, ((x_v - 140/3) / (140 - 140/3)) * 100)) : null;
    const s_door = x1 !== null ? Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100)) : null;
    addScore(s_width_h); addScore(s_width_v); addScore(s_door); addScore(s_step_slope);
  } else if (mappedCategory === 'S4_엘리베이터') {
    const s_width_h = x_h !== null ? Math.min(100, Math.max(0, ((x_h - 160/3) / (160 - 160/3)) * 100)) : null;
    const s_width_v = x_v !== null ? Math.min(100, Math.max(0, ((x_v - 45) / (135 - 45)) * 100)) : null;
    const s_door = x1 !== null ? Math.min(100, Math.max(0, ((x1 - 30) / (90 - 30)) * 100)) : null;
    addScore(s_width_h); addScore(s_width_v); addScore(s_door); addScore(s_step_slope);
  } else if (mappedCategory === 'S5_주차장') {
    const s_width_h = x_h !== null ? Math.min(100, Math.max(0, ((x_h - 110) / (330 - 110)) * 100)) : null;
    const s_width_v = x_v !== null ? Math.min(100, Math.max(0, ((x_v - 500/3) / (500 - 500/3)) * 100)) : null;
    addScore(s_width_h); addScore(s_width_v);
  }

  let fScore = 0;
  if (scoresToAverage.length > 0) {
    fScore = scoresToAverage.reduce((a, b) => a + b, 0) / scoresToAverage.length;
  }
  if (isNaN(fScore)) fScore = 0;

  const rawPhoto = r['사진'] || '';
  const photoUrl = rawPhoto ? (rawPhoto.startsWith('/') ? rawPhoto : `/${rawPhoto}`) : null;

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
    image_url: photoUrl,
    raw_data: r
  };
}).filter(f => !isNaN(f.lat) && !isNaN(f.lng));

console.log('Valid facilities count:', validFacilities.length);

const getCatAvg = (facs, cat, defaultVal) => {
  const filtered = facs.filter(f => f.category === cat);
  if (filtered.length === 0) return defaultVal;
  return filtered.reduce((sum, f) => sum + f.score, 0) / filtered.length;
};

const s1 = getCatAvg(validFacilities, 'S1_보행로', 50);
const s2 = getCatAvg(validFacilities, 'S2_출입구', 50);
const s3 = getCatAvg(validFacilities, 'S3_화장실', 50);
const s4 = getCatAvg(validFacilities, 'S4_엘리베이터', 50);
const s5 = getCatAvg(validFacilities, 'S5_주차장', 50);

const finalIndexRaw = (s1 * s2 + s2 * s3 + s3 * s4 + s4 * s5 + s5 * s1) / 500;
console.log('Final calculated score:', finalIndexRaw);

const mainZoneName = allRows[0]['프로젝트명'] || '전대후문무장애지도';
const safeName = mainZoneName.replace(/[^a-zA-Z0-9가-힣]/g, '');
const mainZoneId = safeName ? `z_${safeName}` : `z_${Date.now()}`;

const points = turf.featureCollection(
  validFacilities.map(f => turf.point([f.lng, f.lat], { id: f.id }))
);

let mainPolyGeoJson = null;
if (points.features.length >= 3) {
  try {
    const hull = convex(points);
    if (hull) mainPolyGeoJson = hull.geometry;
  } catch (e) {
    console.error('Convex hull failed', e);
  }
}

if (!mainPolyGeoJson && points.features.length >= 1) {
  const lats = points.features.map(p => p.geometry.coordinates[1]);
  const lngs = points.features.map(p => p.geometry.coordinates[0]);
  mainPolyGeoJson = turf.polygon([[
    [Math.min(...lngs) - 0.0002, Math.min(...lats) - 0.0002],
    [Math.max(...lngs) + 0.0002, Math.min(...lats) - 0.0002],
    [Math.max(...lngs) + 0.0002, Math.max(...lats) + 0.0002],
    [Math.min(...lngs) - 0.0002, Math.max(...lats) + 0.0002],
    [Math.min(...lngs) - 0.0002, Math.min(...lats) - 0.0002]
  ]]).geometry;
}

const zone = {
  id: mainZoneId,
  name: mainZoneName,
  level: '대구역',
  polygon: mainPolyGeoJson,
  final_index: parseFloat(finalIndexRaw.toFixed(1)),
  color_grade: finalIndexRaw >= 90 ? 'A' : finalIndexRaw >= 70 ? 'B' : 'C',
  subZones: []
};

const facilities = validFacilities.map(f => ({
  id: f.id,
  zone_id: mainZoneId,
  sub_zone_id: null,
  name: f.name,
  category: f.category,
  facility_type: f.category.split('_')[1] || '시설',
  location: { lat: f.lat, lng: f.lng },
  image_url: f.image_url,
  status: '공개',
  score: f.score,
  last_survey_date: '2026-09-09'
}));

const categoryScores = validFacilities.map(f => {
  const r = f.raw_data;
  const metrics = {
    유효폭: r['유효폭'] || r['문너비'] || r['문 너비'] || '',
    가로너비: r['가로 너비'] || r['가로너비'] || '',
    세로너비: r['세로 너비'] || r['세로너비'] || '',
    단차: r['단차'] || '',
    기울기: r['기울기'] || '',
    문형태: r['출입문 종류'] || r['문형태'] || '',
    '경사로 유무': r['경사로 유무'] !== undefined ? (r['경사로 유무'] ? '있음' : '없음') : '',
    '유효폭 5m 이상': r['유효폭 5m 이상'] !== undefined ? (r['유효폭 5m 이상'] ? '예' : '아니오') : '',
    비고: r['기타 특이사항'] || r['비고'] || r['기타사항'] || ''
  };
  return {
    id: `cs_${f.id}`,
    facility_id: f.id,
    category: f.category,
    score: f.score,
    reason: JSON.stringify(metrics)
  };
});

const measurements = validFacilities.map(f => ({
  id: `m_${f.id}`,
  facility_id: f.id,
  category: f.category,
  field_name: '단차/기울기/유효폭',
  value: `${f.stepHeight || 0}cm / ${f.incline || 0}% / ${f.doorWidth || 0}m`,
  unit: '혼합'
}));

const diagnosisTexts = validFacilities.map(f => ({
  id: `d_${f.id}`,
  facility_id: f.id,
  category: f.category,
  text: `[AI 요약] ${f.name}의 ${f.category.split('_')[1]} 진단 점수는 ${f.score.toFixed(1)}점입니다.`
}));

const fullMockData = {
  zones: [zone],
  facilities,
  measurements,
  categoryScores,
  diagnosisTexts
};

fs.writeFileSync('src/data/mock.json', JSON.stringify(fullMockData, null, 2), 'utf8');
console.log('✅ Successfully wrote full mock.json with', facilities.length, 'facilities!');
