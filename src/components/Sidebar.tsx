import { useState } from 'react';
import { MockData } from '@/app/page';
import RadarChartComp from './RadarChartComp';
import BarChartComp from './BarChartComp';
import FacilityDetail from './FacilityDetail';
import { ChevronRight, ArrowLeft, MapPin, Printer } from 'lucide-react';
import { getColorForGrade } from '@/constants/colors';

interface SidebarProps {
  data: MockData;
  selectedZone: MockData['zones'][0] | null;
  zoneFacilities: MockData['facilities'];
  selectedFacility: MockData['facilities'][0] | null;
  onSelectFacility: (id: string) => void;
  onBackToZones: () => void;
  onBackToZone: () => void;
  onSelectZone: (id: string) => void;
}

export default function Sidebar({
  data,
  selectedZone,
  zoneFacilities,
  selectedFacility,
  onSelectFacility,
  onBackToZones,
  onBackToZone,
  onSelectZone
}: SidebarProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!selectedZone) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6">
          <MapPin size={32} />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">구역을 선택해주세요</h2>
        <p className="mt-2 text-zinc-500 max-w-xs">지도에서 조사된 구역을 클릭하면 상세 진단 데이터와 차트를 확인할 수 있습니다.</p>
        
        <div className="mt-12 w-full text-left">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">조사된 구역 목록</h3>
          <div className="space-y-3">
            {data.zones.map(z => (
              <button 
                key={z.id} 
                onClick={() => onSelectZone(z.id)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <span className="font-medium text-zinc-800">{z.name}</span>
                <span className="text-sm px-2.5 py-1 rounded-full font-medium" 
                  style={{ 
                    backgroundColor: getColorForGrade(z.color_grade).fill + '33', 
                    color: getColorForGrade(z.color_grade).stroke 
                  }}>
                  {z.final_index !== null ? (z.final_index as number).toFixed(1) : '산출보류'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selectedFacility) {
    return (
      <div className="flex flex-col h-full print:block print:h-auto">
        <div className="p-4 border-b border-zinc-200 bg-white sticky top-0 z-10 print:hidden flex justify-between items-center">
          <button 
            onClick={onBackToZone}
            className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft size={16} className="mr-1" />
            구역 정보로 돌아가기
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Printer size={14} className="mr-1.5" />
            PDF 보고서 인쇄
          </button>
        </div>
        <FacilityDetail 
          facility={selectedFacility} 
          measurements={data.measurements.filter(m => m.facility_id === selectedFacility.id)}
          scores={data.categoryScores.filter(s => s.facility_id === selectedFacility.id)}
          texts={data.diagnosisTexts.filter(t => t.facility_id === selectedFacility.id)}
        />
      </div>
    );
  }

  // Zone Selected View (F2 & F4 concepts)
  const zoneScores = data.categoryScores.filter(cs => zoneFacilities.some(f => f.id === cs.facility_id));
  const avgScores: Record<string, { total: number, count: number }> = {
    'S1_보행로': { total: 0, count: 0 },
    'S2_출입구': { total: 0, count: 0 },
    'S3_화장실': { total: 0, count: 0 },
    'S4_엘리베이터': { total: 0, count: 0 },
    'S5_주차장': { total: 0, count: 0 },
  };

  zoneScores.forEach(s => {
    if (s.score !== null && avgScores[s.category]) {
      avgScores[s.category].total += s.score;
      avgScores[s.category].count++;
    }
  });

  const radarData = Object.keys(avgScores).map(cat => {
    const realScore = avgScores[cat].count > 0 ? Math.round(avgScores[cat].total / avgScores[cat].count) : 0;
    return {
      id: cat,
      subject: cat.split('_')[1],
      A: realScore,
      visualA: realScore < 5 ? 5 : realScore, // minimum 5 for visual area rendering
      fullMark: 100
    };
  });

  // Calculate facility ranking for the selected category (or overall if null, but user wants category-specific)
  let rankingTitle = "전체 시설 접근성 순위";
  let ranking = zoneFacilities.map(f => {
    let scores = data.categoryScores.filter(cs => cs.facility_id === f.id && cs.score !== null);
    if (selectedCategory) {
      scores = scores.filter(cs => cs.category === selectedCategory);
      rankingTitle = `${selectedCategory.split('_')[1]} 시설 접근성 순위`;
    }
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length : 0;
    return { ...f, avgScore: avg, hasData: scores.length > 0 };
  }).filter(f => f.hasData).sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 border-b border-zinc-200 bg-white sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => {
            if (selectedCategory) setSelectedCategory(null);
            else onBackToZones();
          }}
          className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft size={16} className="mr-1" />
          {selectedCategory ? '전체 카테고리로 돌아가기' : '지도 초기화'}
        </button>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase mb-1 block">Zone Details</span>
            <h2 className="text-2xl font-bold text-zinc-900">{selectedZone.name}</h2>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-1">최종 넓이지수</div>
            <div className="text-2xl font-bold" style={{ color: getColorForGrade(selectedZone.color_grade).stroke }}>
              {selectedZone.final_index !== null ? (selectedZone.final_index as number).toFixed(1) : '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1">
        {/* Radar Chart Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-zinc-900">카테고리별 접근성 균형</h3>
            {!selectedCategory && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-medium">카테고리를 클릭하세요</span>}
          </div>
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 flex flex-col justify-center">
            <RadarChartComp 
              data={radarData} 
              onCategoryClick={setSelectedCategory} 
            />
            {/* Explicit Category Buttons for accessibility/clarity */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {Object.keys(avgScores).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors
                    ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
                >
                  {cat.split('_')[1]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Facility Ranking & Bar Chart shown conditionally or updated based on selectedCategory */}
        {selectedCategory && (
          <>
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900">{rankingTitle}</h3>
                <span className="text-sm text-zinc-500">조사된 시설 {ranking.length}곳</span>
              </div>
              <div className="space-y-2">
                {ranking.slice(0, 10).map((f, i) => {
                  const isBottom = i >= ranking.length - Math.min(3, ranking.length) || f.avgScore < 50; 
                  return (
                    <button 
                      key={f.id}
                      onClick={() => onSelectFacility(f.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all hover:shadow-md
                        ${isBottom ? 'bg-red-50/50 border-red-100 hover:border-red-300' : 'bg-white border-zinc-200 hover:border-blue-300'}`}
                    >
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 
                          ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 
                            isBottom ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900">{f.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{f.facility_type}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className={`text-sm font-bold mr-3 ${isBottom ? 'text-red-600' : 'text-zinc-700'}`}>
                          {f.avgScore.toFixed(1)}점
                        </div>
                        <ChevronRight size={16} className="text-zinc-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bar Charts (F4) */}
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <h3 className="text-lg font-bold text-zinc-900 mb-4">세부 측정 항목 통계</h3>
              <BarChartComp 
                facilities={zoneFacilities}
                categoryScores={data.categoryScores}
                selectedCategory={selectedCategory}
                onSelectFacility={onSelectFacility}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
