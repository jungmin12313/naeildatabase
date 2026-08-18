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

export function getColorForScore(score: number | null) {
  if (score === null) return '#9ca3af'; // 산출보류 회색
  
  // 25점 이하: 빨간색 고정
  if (score <= 25) return '#dd3333';
  if (score >= 100) return '#81d742';

  // 구간별 기준 색상 (RGB)
  const colorStops = [
    { score: 25,  r: 221, g: 51,  b: 51  }, // #dd3333 (Red)
    { score: 50,  r: 221, g: 153, b: 51  }, // #dd9933 (Orange)
    { score: 75,  r: 238, g: 238, b: 34  }, // #eeee22 (Yellow)
    { score: 100, r: 129, g: 215, b: 66  }  // #81d742 (Green)
  ];

  // 점수가 속한 구간 찾기
  let lower = colorStops[0];
  let upper = colorStops[colorStops.length - 1];

  for (let i = 0; i < colorStops.length - 1; i++) {
    if (score >= colorStops[i].score && score <= colorStops[i + 1].score) {
      lower = colorStops[i];
      upper = colorStops[i + 1];
      break;
    }
  }

  // 구간 내 진행 비율 계산 (0 ~ 1)
  const ratio = (score - lower.score) / (upper.score - lower.score);

  // RGB 수치 보간
  const r = Math.round(lower.r + ratio * (upper.r - lower.r));
  const g = Math.round(lower.g + ratio * (upper.g - lower.g));
  const b = Math.round(lower.b + ratio * (upper.b - lower.b));

  // HEX 코드로 변환
  const toHex = (val: number) => val.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
