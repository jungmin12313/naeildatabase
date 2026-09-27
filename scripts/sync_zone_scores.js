const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncZoneScores() {
  console.log("Fetching zones, facilities, and category scores...");
  
  const { data: zones, error: zErr } = await supabase.from('zones').select('*');
  const { data: facilities, error: fErr } = await supabase.from('facilities').select('*');
  const { data: categoryScores, error: csErr } = await supabase.from('category_scores').select('*');

  if (zErr || fErr || csErr) {
    console.error("Error fetching data:", zErr || fErr || csErr);
    return;
  }

  if (!zones || zones.length === 0) {
    console.log("No zones found in DB. You might be relying purely on mock.json.");
    return;
  }

  for (const zone of zones) {
    const zoneFacilities = facilities.filter(f => f.zone_id === zone.id);

    const confirmedFacilityIds = zoneFacilities.filter(f => {
      const c = categoryScores.filter(cs => cs.facility_id === f.id && cs.score !== null).length;
      return c > 0;
    }).map(f => f.id);

    const scores = categoryScores.filter(cs => confirmedFacilityIds.includes(cs.facility_id) && cs.score !== null);
    
    const avgs = {
      'S1_보행로': { total: 0, count: 0 },
      'S2_출입구': { total: 0, count: 0 },
      'S3_화장실': { total: 0, count: 0 },
      'S4_엘리베이터': { total: 0, count: 0 },
      'S5_주차장': { total: 0, count: 0 },
    };

    scores.forEach(s => {
      if (avgs[s.category]) {
        avgs[s.category].total += s.score;
        avgs[s.category].count++;
      }
    });

    const s1 = avgs['S1_보행로'].count > 0 ? avgs['S1_보행로'].total / avgs['S1_보행로'].count : 50;
    const s2 = avgs['S2_출입구'].count > 0 ? avgs['S2_출입구'].total / avgs['S2_출입구'].count : 50;
    const s3 = avgs['S3_화장실'].count > 0 ? avgs['S3_화장실'].total / avgs['S3_화장실'].count : 50;
    const s4 = avgs['S4_엘리베이터'].count > 0 ? avgs['S4_엘리베이터'].total / avgs['S4_엘리베이터'].count : 50;
    const s5 = avgs['S5_주차장'].count > 0 ? avgs['S5_주차장'].total / avgs['S5_주차장'].count : 50;

    let finalRaw = null;
    if (confirmedFacilityIds.length > 0) {
      finalRaw = (s1 * s2 + s2 * s3 + s3 * s4 + s4 * s5 + s5 * s1) / 500;
    }

    if (finalRaw !== null) {
      console.log(`Zone: ${zone.name} | Old score: ${zone.final_index} | New score: ${finalRaw}`);
      const { error: upErr } = await supabase.from('zones').update({ final_index: finalRaw }).eq('id', zone.id);
      if (upErr) {
        console.error(`Failed to update zone ${zone.id}:`, upErr);
      } else {
        console.log(`✅ Updated ${zone.name} to ${finalRaw}`);
      }
    } else {
      console.log(`Zone: ${zone.name} | Not enough valid facilities to calculate score. Keeping as is.`);
    }
  }

  console.log("Done syncing scores.");
}

syncZoneScores();
