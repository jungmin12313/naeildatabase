import { MockData } from '@/app/page';
import { AlertTriangle, CheckCircle, Image as ImageIcon, Check, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { evaluateMeasurement } from '@/constants/standards';

const RadarChartComp = dynamic(() => import('./RadarChartComp'), { ssr: false });

interface FacilityDetailProps {
  facility: MockData['facilities'][0];
  measurements: MockData['measurements'];
  scores: MockData['categoryScores'];
  texts: MockData['diagnosisTexts'];
}

export default function FacilityDetail({ facility, measurements, scores, texts }: FacilityDetailProps) {
  const avgScore = scores.filter(s => s.score !== null).reduce((acc, curr, _, arr) => acc + (curr.score || 0) / arr.length, 0);

  const radarData = ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'].map(cat => {
    const s = scores.find(score => score.category === cat);
    return {
      id: cat,
      subject: cat.split('_')[1],
      A: s?.score || 0,
      visualA: (s?.score || 0) < 5 ? 5 : (s?.score || 0),
      fullMark: 100
    };
  });

  const parseDiagnosis = (text: string) => {
    let problem = "-";
    let recommendation = "-";
    if (text.includes("수집된")) {
      const parts = text.split("수집된");
      recommendation = parts[0].replace("[AI 요약]", "").trim();
      problem = "수집된" + parts[1].trim();
    } else {
      recommendation = text.replace("[AI 요약]", "").trim();
      problem = "현장 세부 데이터 참조";
    }
    return { problem, recommendation };
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/50 print:bg-white">
      <div className="p-6 bg-white border-b border-zinc-200 print:border-b-2 print:border-zinc-900 print:pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full print:border print:border-zinc-300 print:bg-transparent">
            {facility.facility_type}
          </span>
          <span className="text-sm font-bold text-blue-600 print:text-zinc-900">종합 {avgScore.toFixed(1)}점</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-1">{facility.name}</h2>
        <p className="text-sm text-zinc-500">최근 조사일: {facility.last_survey_date}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Facility Radar Chart (For Print / Visual summary) */}
        {scores.length > 0 && (
          <section className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm print:border-zinc-300 page-break-avoid">
            <h3 className="font-bold text-zinc-900 mb-2 text-center">종합 접근성 균형</h3>
            <div className="flex justify-center h-48">
              <RadarChartComp data={radarData} onCategoryClick={() => {}} />
            </div>
          </section>
        )}
        {texts.map(text => {
          const catName = text.category.split('_')[1];
          const scoreObj = scores.find(s => s.category === text.category);
          const catMeasurements = measurements.filter(m => m.category === text.category);
          
          if (!scoreObj || scoreObj.score === null) return null;

          const photoM = catMeasurements.find(m => m.photo_url);

          return (
            <section key={text.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <h3 className="font-bold text-zinc-900">{catName}</h3>
                <span className={`text-sm font-bold ${scoreObj.score < 50 ? 'text-red-500' : scoreObj.score < 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {scoreObj.score.toFixed(1)}점
                </span>
              </div>
              
              <div className="p-4 space-y-4">
                {/* AI Text Box with Badge */}
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 print:bg-white print:border-zinc-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-700 flex items-center print:text-zinc-900">
                      <CheckCircle size={14} className="mr-1.5" />
                      AI 진단 요약
                    </span>
                    {text.source === 'AI생성' && (
                      <span className="flex items-center text-[10px] font-bold px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full print:border print:border-yellow-800 print:bg-white">
                        <AlertTriangle size={10} className="mr-1" />
                        확인 필요 (AI)
                      </span>
                    )}
                  </div>
                  
                  {/* AI Structured Table */}
                  <table className="w-full text-left border-collapse text-sm border border-blue-100 print:border-zinc-300 bg-white rounded-lg overflow-hidden">
                    <tbody>
                      <tr className="border-b border-blue-50 print:border-zinc-200">
                        <th className="w-1/3 py-2 px-3 bg-blue-50/50 print:bg-zinc-50 text-blue-800 print:text-zinc-800 font-semibold align-top border-r border-blue-50 print:border-zinc-200">주요 문제점</th>
                        <td className="py-2 px-3 text-zinc-700 leading-relaxed">{parseDiagnosis(text.text).problem}</td>
                      </tr>
                      <tr>
                        <th className="w-1/3 py-2 px-3 bg-blue-50/50 print:bg-zinc-50 text-blue-800 print:text-zinc-800 font-semibold align-top border-r border-blue-50 print:border-zinc-200">개선 권고 사항</th>
                        <td className="py-2 px-3 text-zinc-700 leading-relaxed">{parseDiagnosis(text.text).recommendation}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Measurements Data */}
                {catMeasurements.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">세부 실측 데이터 및 판별</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {catMeasurements.map(m => {
                        const { isPass, description } = evaluateMeasurement(m.field_name, m.value);
                        return (
                          <div key={m.id} className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 flex flex-col md:flex-row md:items-center justify-between print:bg-white print:border-zinc-200 print:p-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-600 mb-0.5">{m.field_name}</span>
                              {description && <span className="text-[10px] text-zinc-400">{description}</span>}
                            </div>
                            <div className="flex items-center mt-2 md:mt-0">
                              <span className="text-sm font-black text-zinc-900 mr-3">
                                {typeof m.value === 'boolean' ? (m.value ? '있음' : '없음') : m.value}{m.unit}
                              </span>
                              {isPass === true && (
                                <span className="flex items-center text-[10px] font-bold px-2 py-1 bg-green-100 text-green-700 rounded print:border print:border-green-700 print:bg-transparent">
                                  <Check size={12} className="mr-0.5" /> 적합
                                </span>
                              )}
                              {isPass === false && (
                                <span className="flex items-center text-[10px] font-bold px-2 py-1 bg-red-100 text-red-700 rounded print:border print:border-red-700 print:bg-transparent">
                                  <X size={12} className="mr-0.5" /> 부적합
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Photo Placeholder */}
                {photoM && photoM.photo_url && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">현장 사진</h4>
                    <div className="w-full h-32 bg-zinc-100 rounded-xl border border-zinc-200 flex flex-col items-center justify-center text-zinc-400">
                      <ImageIcon size={24} className="mb-1 opacity-50" />
                      <span className="text-xs">사진 데이터 연동 대기중</span>
                      <span className="text-[10px] opacity-70 mt-1 max-w-[80%] truncate">{photoM.photo_url}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
