export function getZoneRadarData(facilities: any[], rawCategoryScores: any[]) {
  const categories = ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'];
  
  const avgs: Record<string, { total: number, count: number }> = {
    'S1_보행로': { total: 0, count: 0 },
    'S2_출입구': { total: 0, count: 0 },
    'S3_화장실': { total: 0, count: 0 },
    'S4_엘리베이터': { total: 0, count: 0 },
    'S5_주차장': { total: 0, count: 0 },
  };

  facilities.forEach(f => {
    const fScores = rawCategoryScores.filter(s => s.facility_id === f.id);
    fScores.forEach(s => {
      if (s.score !== null && s.score !== undefined && avgs[s.category]) {
        avgs[s.category].total += s.score;
        avgs[s.category].count++;
      }
    });
  });

  // Calculate real averages for categories that have data
  let globalTotal = 0;
  let globalCount = 0;
  const realScores: Record<string, number | null> = {};

  categories.forEach(cat => {
    if (avgs[cat].count > 0) {
      const avg = avgs[cat].total / avgs[cat].count;
      realScores[cat] = avg;
      globalTotal += avg;
      globalCount++;
    } else {
      realScores[cat] = null;
    }
  });

  // Fallback average for categories with NO data at all
  // ONLY impute if we are dealing with a zone (multiple facilities). For a single facility, unmeasured is 0.
  const fallbackAvg = (facilities.length > 1 && globalCount > 0) ? (globalTotal / globalCount) : 0;

  const radar = categories.map(cat => {
    const realScore = realScores[cat] !== null ? Math.round(realScores[cat] as number) : Math.round(fallbackAvg);
    return {
      id: cat,
      subject: cat.split('_')[1],
      A: realScore,
      visualA: realScore < 5 ? 5 : realScore, // minimum for rendering
      fullMark: 100,
      isImputed: realScores[cat] === null
    };
  });

  return radar;
}

export function getNormalizedCategoryScores(facilities: any[], rawCategoryScores: any[]) {
  // Legacy: if needed by other components, just return raw for now.
  // Actually, we shouldn't mutate facility-level scores for the radar.
  // The UI tables should show the RAW scores (blanks for unmeasured).
  return rawCategoryScores;
}
