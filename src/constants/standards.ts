export interface MeasurementStandard {
  description: string;
  checkPass: (value: any) => boolean | null;
}

export const accessibilityStandards: Record<string, MeasurementStandard> = {
  "유효폭": {
    description: "법적 기준: 1.2m 이상",
    checkPass: (value) => typeof value === 'number' && value >= 1.2
  },
  "단차": {
    description: "법적 기준: 2.0cm 이하",
    checkPass: (value) => typeof value === 'number' && value <= 2.0
  },
  "기울기": {
    description: "법적 기준: 4.76도 이하",
    checkPass: (value) => typeof value === 'number' && value <= 4.76
  },
  "문너비": {
    description: "법적 기준: 0.8m 이상",
    checkPass: (value) => typeof value === 'number' && value >= 0.8
  },
  "출입문 종류": {
    description: "권장: 자동문/미닫이문",
    checkPass: (value) => {
      if (typeof value !== 'string') return null;
      return value.includes('자동문') || value.includes('미닫이');
    }
  },
  "경사로 유무": {
    description: "설치 여부 판별",
    checkPass: (value) => value === true
  },
  "활동공간": {
    description: "법적 기준: 1.4m 이상 확보",
    checkPass: (value) => typeof value === 'number' && value >= 1.4
  }
};

export function evaluateMeasurement(fieldName: string, value: any): { isPass: boolean | null, description: string } {
  const standard = accessibilityStandards[fieldName];
  if (!standard) return { isPass: null, description: "" };
  return {
    isPass: standard.checkPass(value),
    description: standard.description
  };
}
