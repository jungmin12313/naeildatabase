import { MockData } from '@/app/page';
import { FileText, Image as ImageIcon } from 'lucide-react';

interface FacilityDetailProps {
  facility: MockData['facilities'][0];
  measurements: MockData['measurements'];
  scores: MockData['categoryScores'];
  texts: MockData['diagnosisTexts'];
}

export default function FacilityDetail({ facility, scores }: FacilityDetailProps) {
  const avgScore = scores.filter(s => s.score !== null).reduce((acc, curr, _, arr) => acc + (curr.score || 0) / arr.length, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/50 print:bg-white">
      <div className="p-6 bg-white border-b border-zinc-200 print:border-b-2 print:border-zinc-900 print:pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full print:border print:border-zinc-300 print:bg-transparent">
            {facility.facility_type || '시설 정보'}
          </span>
          <span className="text-sm font-bold text-blue-600 print:text-zinc-900">종합 {avgScore ? avgScore.toFixed(1) : 0}점</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-1">{facility.name}</h2>
        <p className="text-sm text-zinc-500">최근 조사일: {facility.last_survey_date || '알 수 없음'}</p>
      </div>

      <div className="p-6 space-y-6">
        {scores.map(scoreObj => {
          if (!scoreObj || scoreObj.score === null) return null;
          const catName = scoreObj.category.split('_')[1];
          
          let rawMetrics: Record<string, string | number> = {};
          // @ts-ignore
          if (scoreObj.reason) {
            try {
              // @ts-ignore
              rawMetrics = JSON.parse(scoreObj.reason);
            } catch (e) {
              // Not JSON
            }
          }

          return (
            <section key={scoreObj.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <h3 className="font-bold text-zinc-900">{catName} 평가 상세</h3>
                <span className={`text-sm font-bold ${scoreObj.score < 50 ? 'text-red-500' : scoreObj.score < 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {scoreObj.score.toFixed(1)}점
                </span>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Measurements Data */}
                {Object.keys(rawMetrics).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">세부 실측 수치 및 특이사항</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(rawMetrics).map(([key, value]) => {
                        if (!value && value !== 0) return null;
                        const isNotes = key === '비고' || key === '특이사항';
                        return (
                          <div key={key} className={`bg-zinc-50 rounded-lg p-3 border border-zinc-100 flex flex-col ${isNotes ? 'md:col-span-2' : ''} print:bg-white print:border-zinc-200 print:p-2`}>
                            <span className="text-xs font-bold text-zinc-600 mb-1 flex items-center gap-1">
                              {isNotes && <FileText size={12} />}
                              {key}
                            </span>
                            <span className={`text-sm font-black text-zinc-900 ${isNotes ? 'font-medium whitespace-pre-wrap' : ''}`}>
                              {value}
                              {!isNotes && (key.includes('유효폭') || key.includes('너비')) && typeof value !== 'boolean' && !String(value).match(/[a-zA-Z가-힣°]/) && 'm'}
                              {!isNotes && key.includes('단차') && typeof value !== 'boolean' && !String(value).match(/[a-zA-Z가-힣°]/) && 'cm'}
                              {!isNotes && key.includes('기울기') && typeof value !== 'boolean' && !String(value).match(/[a-zA-Z가-힣°]/) && '°'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {(() => {
          const imageUrl = (facility as any).image_url;
          if (!imageUrl) return null;
          return (
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">현장 사진</h4>
              <div className="w-full relative rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50 flex items-center justify-center min-h-[200px]">
                {(imageUrl.startsWith('http') || imageUrl.startsWith('/')) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={encodeURI(imageUrl)} alt="현장 사진" className="w-full h-auto object-cover max-h-96 rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
                    <ImageIcon size={32} className="mb-2 opacity-50" />
                    <span className="text-sm font-medium">사진 링크 오류</span>
                    <span className="text-xs mt-1 break-all px-4">{imageUrl}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
