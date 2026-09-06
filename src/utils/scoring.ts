export function getNormalizedCategoryScores(facilities: any[], rawCategoryScores: any[]) {
  const normalizedScores: any[] = [];
  const categories = ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'];

  facilities.forEach(f => {
    const fScores = rawCategoryScores.filter(s => s.facility_id === f.id);
    const measuredScores = fScores.filter(s => s.score !== null && s.score !== undefined);
    
    let avg = 0;
    if (measuredScores.length > 0) {
      avg = measuredScores.reduce((sum, s) => sum + s.score, 0) / measuredScores.length;
    }

    categories.forEach(cat => {
      const existing = fScores.find(s => s.category === cat);
      const isMeasured = existing && existing.score !== null && existing.score !== undefined;
      const scoreValue = isMeasured ? existing.score : avg;
      
      normalizedScores.push({
        facility_id: f.id,
        category: cat,
        score: scoreValue,
        isMeasured // to keep track of original coverage
      });
    });
  });

  return normalizedScores;
}
