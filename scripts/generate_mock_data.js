const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const turfConvex = require('@turf/convex').default;
const turfHelpers = require('@turf/helpers');

const filePath = path.join(__dirname, '../docs/내일 현장답사.xlsx');
const outPath = path.join(__dirname, '../src/data/mock.json');

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function score(x, zeroPoint, hundredPoint) {
  return clamp(((x - zeroPoint) / (hundredPoint - zeroPoint)) * 100, 0, 100);
}

function parseMetersToCm(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = Number(val);
  if (isNaN(num)) return 0;
  if (num < 10) return num * 100; // Assume meters if < 10
  return num; // Else assume cm
}

function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function calcStepRampComb(step, rampHas, slope) {
  if (step <= 2) return 100;
  // 단차>2cm → 0.5·단차[0점6,100점2] + 0.5·경사로[0점14.4,100점4.8]
  // 경사로가 없으면(rampHas = false) 기울기 점수는 0점으로 간주? (기울기 14.4 초과)
  const stepScore = score(step, 6, 2);
  const rampScore = rampHas ? score(slope, 14.4, 4.8) : 0;
  return 0.5 * stepScore + 0.5 * rampScore;
}

function mapCategory(cat) {
  if (!cat) return null;
  if (cat.includes('보행로')) return 'S1_보행로';
  if (cat.includes('출입구') || cat.includes('출입문')) return 'S2_출입구';
  if (cat.includes('화장실')) return 'S3_화장실';
  if (cat.includes('엘리베이터') || cat.includes('승강기')) return 'S4_엘리베이터';
  if (cat.includes('주차장')) return 'S5_주차장';
  return null; // Ignore if not matching 5 categories
}

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = '생활권';
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);

  const zonesMap = new Map();
  const facilitiesMap = new Map();
  const measurements = [];
  const categoryScores = [];
  const diagnosisTexts = [];

  let mId = 1;

  rawData.forEach(row => {
    const projName = row['프로젝트명'];
    const facName = row['장소명'];
    const gps = row['GPS'];
    const catRaw = row['카테고리'];
    
    if (!projName || !facName || !gps || !catRaw) return;

    const cat = mapCategory(catRaw);
    if (!cat) return;

    // Parse GPS
    const coords = gps.split(',').map(s => Number(s.trim()));
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return;
    const [lat, lng] = coords;

    // Build zone
    if (!zonesMap.has(projName)) {
      zonesMap.set(projName, {
        id: `z_${zonesMap.size + 1}`,
        name: projName,
        level: '소구역', // Defaulting to 소구역
        points: []
      });
    }
    zonesMap.get(projName).points.push([lng, lat]);

    // Build facility
    const facKey = `${projName}_${facName}`;
    if (!facilitiesMap.has(facKey)) {
      facilitiesMap.set(facKey, {
        id: `f_${facilitiesMap.size + 1}`,
        name: facName,
        zone_id: zonesMap.get(projName).id,
        location: { lat, lng },
        facility_type: '일반',
        last_survey_date: '2026-08-17',
        status: '공개',
        measurementsData: {} // Temp storage for score calc
      });
    }
    const facility = facilitiesMap.get(facKey);
    facility.measurementsData[cat] = row;

    // Build measurements records
    const fields = ['유효폭', '가로너비', '세로너비', '문너비', '단차', '기울기', '출입문 종류', '경사로 유무'];
    fields.forEach(f => {
      if (row[f] !== undefined && row[f] !== '') {
        measurements.push({
          id: `m_${mId++}`,
          facility_id: facility.id,
          category: cat,
          field_name: f,
          value: row[f],
          unit: f.includes('폭') || f.includes('너비') || f.includes('단차') ? (Number(row[f]) < 10 ? 'm' : 'cm') : (f.includes('기울기') ? '도' : ''),
          photo_url: row['사진'] || '',
          survey_date: '2026-08-17'
        });
      }
    });
  });

  // Calculate scores
  const facilityScoresByZone = new Map(); // zone_id -> { facId -> { S1..S5 } }
  
  for (const fac of facilitiesMap.values()) {
    if (!facilityScoresByZone.has(fac.zone_id)) {
      facilityScoresByZone.set(fac.zone_id, {});
    }
    const zoneFacScores = facilityScoresByZone.get(fac.zone_id);
    zoneFacScores[fac.id] = {};

    const cats = ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'];
    cats.forEach(cat => {
      const row = fac.measurementsData[cat];
      let scoreVal = null;

      if (row) {
        const width = parseMetersToCm(row['유효폭']);
        const step = parseNum(row['단차']);
        const slope = parseNum(row['기울기']);
        const rampHas = String(row['경사로 유무']).includes('O') || String(row['경사로 유무']).includes('o') || String(row['경사로 유무']).includes('있');
        const widthH = parseMetersToCm(row['가로너비']);
        const widthV = parseMetersToCm(row['세로너비']);
        const doorW = parseMetersToCm(row['문너비']);

        if (cat === 'S1_보행로') {
          scoreVal = (1/3)*score(width, 40, 120) + (1/3)*score(step, 6, 2) + (1/3)*score(slope, 14.4, 4.8);
        } else if (cat === 'S2_출입구') {
          scoreVal = 0.5*score(width, 30, 90) + 0.5*calcStepRampComb(step, rampHas, slope);
        } else if (cat === 'S3_화장실') {
          scoreVal = 0.25*score(widthH, 46.67, 140) + 0.25*score(widthV, 46.67, 140) + 0.25*score(doorW, 30, 90) + 0.25*calcStepRampComb(step, rampHas, slope);
        } else if (cat === 'S4_엘리베이터') {
          scoreVal = 0.25*score(widthH, 53.33, 160) + 0.25*score(widthV, 45, 135) + 0.25*score(doorW, 30, 90) + 0.25*calcStepRampComb(step, rampHas, slope);
        } else if (cat === 'S5_주차장') {
          scoreVal = 0.5*score(widthH, 110, 330) + 0.5*score(widthV, 166.67, 500);
        }
      }

      if (scoreVal !== null) {
        zoneFacScores[fac.id][cat] = scoreVal;
        categoryScores.push({
          id: `cs_${categoryScores.length + 1}`,
          facility_id: fac.id,
          category: cat,
          score: scoreVal,
          status: '계산완료',
          calculated_at: new Date().toISOString()
        });

        // Generate AI Text
        let aiText = `[AI 요약] ${cat.split('_')[1]}의 접근성 점수는 ${scoreVal.toFixed(1)}점입니다. `;
        if (scoreVal < 50) aiText += "개선이 강력히 권장됩니다. 수집된 측정 데이터를 바탕으로 단차나 유효폭의 기준 미달이 확인됩니다.";
        else if (scoreVal < 80) aiText += "일부 항목이 권장 기준에 미달하지만 대체로 접근 가능합니다.";
        else aiText += "접근성이 우수하여 휠체어 등 보행 약자의 이용이 원활합니다.";

        diagnosisTexts.push({
          id: `dt_${diagnosisTexts.length + 1}`,
          facility_id: fac.id,
          category: cat,
          text: aiText,
          source: 'AI생성',
          review_status: '확인필요',
          reviewed_by: null,
          reviewed_at: null
        });
      } else {
        // N/A
        categoryScores.push({
          id: `cs_${categoryScores.length + 1}`,
          facility_id: fac.id,
          category: cat,
          score: null,
          status: 'N_A',
          calculated_at: new Date().toISOString()
        });
      }
    });
    
    delete fac.measurementsData;
  }

  // Calculate Zone polygons and final index
  const finalZones = [];
  for (const [name, zone] of zonesMap.entries()) {
    let polygon = null;
    if (zone.points.length >= 3) {
      try {
        const pointsF = turfHelpers.featureCollection(zone.points.map(p => turfHelpers.point(p)));
        const hull = turfConvex(pointsF);
        polygon = hull ? hull.geometry : null;
      } catch (e) {
        console.error("Convex hull error for zone", name, e);
      }
    } else if (zone.points.length > 0) {
      // Just a bounding box or point buffer for <3 points (fallback)
      const [lng, lat] = zone.points[0];
      polygon = {
        type: 'Polygon',
        coordinates: [[[lng-0.001, lat-0.001], [lng+0.001, lat-0.001], [lng+0.001, lat+0.001], [lng-0.001, lat+0.001], [lng-0.001, lat-0.001]]]
      };
    }

    const facScoresMap = facilityScoresByZone.get(zone.id) || {};
    const avgScores = { 'S1_보행로':0, 'S2_출입구':0, 'S3_화장실':0, 'S4_엘리베이터':0, 'S5_주차장':0 };
    const counts = { 'S1_보행로':0, 'S2_출입구':0, 'S3_화장실':0, 'S4_엘리베이터':0, 'S5_주차장':0 };

    Object.values(facScoresMap).forEach(fs => {
      Object.keys(fs).forEach(k => {
        if (fs[k] !== undefined && fs[k] !== null) {
          avgScores[k] += fs[k];
          counts[k]++;
        }
      });
    });

    const S1 = counts['S1_보행로'] > 0 ? avgScores['S1_보행로'] / counts['S1_보행로'] : null;
    const S2 = counts['S2_출입구'] > 0 ? avgScores['S2_출입구'] / counts['S2_출입구'] : null;
    const S3 = counts['S3_화장실'] > 0 ? avgScores['S3_화장실'] / counts['S3_화장실'] : null;
    const S4 = counts['S4_엘리베이터'] > 0 ? avgScores['S4_엘리베이터'] / counts['S4_엘리베이터'] : null;
    const S5 = counts['S5_주차장'] > 0 ? avgScores['S5_주차장'] / counts['S5_주차장'] : null;

    let finalIndex = null;
    let colorGrade = '산출보류';
    if (S1!==null && S2!==null && S3!==null && S4!==null && S5!==null) {
      finalIndex = ((S1*S2) + (S2*S3) + (S3*S4) + (S4*S5) + (S5*S1)) / 50000 * 100;
      if (finalIndex >= 80) colorGrade = 'A';
      else if (finalIndex >= 50) colorGrade = 'B';
      else colorGrade = 'C';
    }

    finalZones.push({
      id: zone.id,
      name: zone.name,
      level: zone.level,
      polygon,
      final_index: finalIndex,
      color_grade: colorGrade
    });
  }

  // Create data dir if not exists
  const dataDir = path.dirname(outPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const result = {
    zones: finalZones,
    facilities: Array.from(facilitiesMap.values()),
    measurements,
    categoryScores,
    diagnosisTexts
  };

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Successfully generated mock data with ${finalZones.length} zones and ${facilitiesMap.size} facilities.`);
} catch (error) {
  console.error('Error generating mock data:', error);
}
