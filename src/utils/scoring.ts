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

  const investigatedCategories: any[] = [];
  
  categories.forEach(cat => {
    if (avgs[cat].count > 0) {
      const avg = avgs[cat].total / avgs[cat].count;
      investigatedCategories.push({
        id: cat,
        subject: cat.split('_')[1],
        A: Math.round(avg),
        visualA: Math.round(avg) < 5 ? 5 : Math.round(avg),
        fullMark: 100,
        isImputed: false
      });
    }
  });

  if (investigatedCategories.length <= 2) {
    let convenienceTotal = 0;
    let convenienceCount = 0;
    
    facilities.forEach(f => {
      const fScores = rawCategoryScores.filter(s => s.facility_id === f.id);
      fScores.forEach(s => {
        if (['S3_화장실', 'S4_엘리베이터', 'S5_주차장'].includes(s.category)) {
          if (s.score !== null && s.score !== undefined) {
            convenienceTotal += s.score;
            convenienceCount++;
          }
        }
      });
    });
    
    const convenienceAvg = convenienceCount > 0 ? (convenienceTotal / convenienceCount) : 0;
    
    investigatedCategories.push({
      id: '편의시설',
      subject: '편의시설',
      A: Math.round(convenienceAvg),
      visualA: Math.round(convenienceAvg) < 5 ? 5 : Math.round(convenienceAvg),
      fullMark: 100,
      isImputed: true
    });
  }

  return investigatedCategories;
}

export function getNormalizedCategoryScores(facilities: any[], rawCategoryScores: any[]) {
  // Legacy: if needed by other components, just return raw for now.
  // Actually, we shouldn't mutate facility-level scores for the radar.
  // The UI tables should show the RAW scores (blanks for unmeasured).
  return rawCategoryScores;
}
