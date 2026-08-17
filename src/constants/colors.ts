export const ZONE_COLORS = {
  A: {
    fill: '#22c55e', // Green-500
    stroke: '#16a34a', // Green-600
    label: '우수 (80점 이상)'
  },
  B: {
    fill: '#eab308', // Yellow-500
    stroke: '#ca8a04', // Yellow-600
    label: '보통 (50점~79점)'
  },
  C: {
    fill: '#ef4444', // Red-500
    stroke: '#dc2626', // Red-600
    label: '미흡 (50점 미만)'
  },
  '산출보류': {
    fill: '#9ca3af', // Gray-400
    stroke: '#6b7280', // Gray-500
    label: '산출 보류 (데이터 부족)'
  }
};

export function getColorForGrade(grade: 'A' | 'B' | 'C' | '산출보류' | string) {
  return ZONE_COLORS[grade as keyof typeof ZONE_COLORS] || ZONE_COLORS['산출보류'];
}
