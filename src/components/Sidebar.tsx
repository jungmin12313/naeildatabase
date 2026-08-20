import { useState, useRef } from 'react';
import { MockData } from '@/app/page';
import RadarChartComp from './RadarChartComp';
import BarChartComp from './BarChartComp';
import FacilityDetail from './FacilityDetail';
import dynamic from 'next/dynamic';
import { ChevronRight, ArrowLeft, MapPin, Printer } from 'lucide-react';

const CategoryDetailCharts = dynamic(() => import('./CategoryDetailCharts'), { ssr: false });
const CategorySpecificChart = dynamic(() => import('./CategorySpecificChart'), { ssr: false });
import { getColorForGrade, getColorForScore } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { isPointInPolygon } from '@/utils/geo';

interface SidebarProps {
  data: MockData;
  selectedZone: MockData['zones'][0] | null;
  zoneFacilities: MockData['facilities'];
  selectedFacility: MockData['facilities'][0] | null;
  onSelectFacility: (id: string) => void;
  onBackToZones: () => void;
  onBackToZone: () => void;
  onSelectZone: (id: string, subId?: string) => void;
  onUpdateZones?: (zones: MockData['zones']) => void;
  isDrawingMode?: boolean;
  setIsDrawingMode?: (val: boolean) => void;
  drawingTargetZoneId?: string | null;
  setDrawingTargetZoneId?: (val: string | null) => void;
  drawnPolygon?: {lat: number, lng: number}[];
  setDrawnPolygon?: (val: {lat: number, lng: number}[]) => void;
  selectedSubZoneId?: string | null;
  onSelectSubZone?: (id: string | null) => void;
  displayFacilities?: MockData['facilities'];
}

export default function Sidebar({
  data,
  selectedZone,
  zoneFacilities,
  selectedFacility,
  onSelectFacility,
  onBackToZones,
  onBackToZone,
  onSelectZone,
  onUpdateZones,
  isDrawingMode,
  setIsDrawingMode,
  drawingTargetZoneId,
  setDrawingTargetZoneId,
  drawnPolygon,
  setDrawnPolygon,
  selectedSubZoneId,
  onSelectSubZone,
  displayFacilities = zoneFacilities
}: SidebarProps) {
  
  const { role, assignedZoneId } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState<any[]>([]);
  const [reselectingSubZoneId, setReselectingSubZoneId] = useState<string | null>(null);

  const handleStartEdit = (z: any) => {
    setEditingZoneId(z.id);
    // @ts-ignore
    setEditForm(z.subZones ? [...z.subZones] : []);
  };

  const handleAddSub = () => {
    setEditForm([...editForm, { id: 'z_new_' + Date.now(), name: '', final_index: null }]);
  };

  const handleUpdateSub = (index: number, field: string, value: any) => {
    const newForm = [...editForm];
    newForm[index] = { ...newForm[index], [field]: value };
    setEditForm(newForm);
  };

  const handleRemoveSub = (index: number) => {
    const newForm = [...editForm];
    newForm.splice(index, 1);
    setEditForm(newForm);
  };

  const handleSaveSub = (z: any) => {
    if (onUpdateZones) {
      const newZones = data.zones.map((zone) => {
        if (zone.id === z.id) {
          return { ...zone, subZones: editForm };
        }
        return zone;
      });
      // @ts-ignore
      onUpdateZones(newZones as any);
    }
    setEditingZoneId(null);
  };

  if (isDrawingMode) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center p-8 text-center animate-in fade-in">
        <MapPin size={48} className="text-blue-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-zinc-900 mb-2">하위 구역 그리기 모드</h2>
        <p className="text-sm text-zinc-500 mb-6">지도에 클릭하여 다각형의 꼭짓점을 찍어 구역을 설정해주세요.</p>
        
        <div className="bg-zinc-50 p-4 rounded-xl w-full border border-zinc-100 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">선택된 꼭짓점:</span>
            <span className="font-bold text-zinc-700">{drawnPolygon?.length || 0}개</span>
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <button 
            onClick={() => {
              if (drawnPolygon && drawnPolygon.length >= 3) {
                // Calculate score based on facilities in drawnPolygon
                const facilitiesInPolygon = data.facilities.filter(f => 
                  f.location && isPointInPolygon({ lat: f.location.lat, lng: f.location.lng }, drawnPolygon)
                );
                
                let totalScore = 0;
                let facilityCount = 0;
                facilitiesInPolygon.forEach(f => {
                  const fScores = data.categoryScores.filter(cs => cs.facility_id === f.id && cs.score !== null);
                  if (fScores.length > 0) {
                    totalScore += fScores.reduce((sum, s) => sum + (s.score as number), 0) / fScores.length;
                    facilityCount++;
                  }
                });
                const subzoneTotalAverage = facilityCount > 0 ? totalScore / facilityCount : 0;

                const catAvgs: Record<string, number> = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 };
                ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'].forEach((cat, index) => {
                  const fScores = data.categoryScores.filter(cs => cs.category === cat && cs.score !== null && facilitiesInPolygon.some(f => f.id === cs.facility_id));
                  if (fScores.length > 0) {
                    catAvgs[`S${index + 1}`] = fScores.reduce((sum, s) => sum + (s.score as number), 0) / fScores.length;
                  } else {
                    catAvgs[`S${index + 1}`] = subzoneTotalAverage; // Use subzone average for missing categories
                  }
                });

                const finalIndexRaw = facilitiesInPolygon.length > 0 ? (
                  catAvgs.S1 * catAvgs.S2 +
                  catAvgs.S2 * catAvgs.S3 +
                  catAvgs.S3 * catAvgs.S4 +
                  catAvgs.S4 * catAvgs.S5 +
                  catAvgs.S5 * catAvgs.S1
                ) / 500 : null;
                
                const avgScore = finalIndexRaw !== null ? Math.round(finalIndexRaw) : null;

                const newSub = {
                  id: 'sub_' + Date.now(),
                  name: `신규 구역 (${facilitiesInPolygon.length}개 시설)`,
                  final_index: avgScore,
                  polygon: {
                    type: 'MultiPolygon',
                    coordinates: [[drawnPolygon.map(p => [p.lng, p.lat])]]
                  }
                };

                // Apply newSub to the target zone
                if (onUpdateZones && drawingTargetZoneId) {
                  const newZones = data.zones.map(z => {
                    if (z.id === drawingTargetZoneId) {
                      // @ts-ignore
                      let updatedSubZones = z.subZones ? [...z.subZones] : [];
                      
                      if (reselectingSubZoneId) {
                        updatedSubZones = updatedSubZones.map((s: any) => 
                          s.id === reselectingSubZoneId 
                            ? { ...s, polygon: newSub.polygon, final_index: newSub.final_index, name: newSub.name } 
                            : s
                        );
                      } else {
                        updatedSubZones.push(newSub as any);
                      }

                      return {
                        ...z,
                        subZones: updatedSubZones
                      };
                    }
                    return z;
                  });
                  // @ts-ignore
                  onUpdateZones(newZones as any);
                  
                  const targetZone = newZones.find(z => z.id === drawingTargetZoneId);
                  if (targetZone) {
                    // @ts-ignore
                    setEditForm(targetZone.subZones ? [...targetZone.subZones] : []);
                  }
                }
                
                if (setIsDrawingMode) setIsDrawingMode(false);
                if (setDrawnPolygon) setDrawnPolygon([]);
                if (setDrawingTargetZoneId) setDrawingTargetZoneId(null);
                setReselectingSubZoneId(null);
                
                // Show the edit form for the newly added subzone
                setTimeout(() => {
                  setExpandedZoneId(drawingTargetZoneId || null);
                  setEditingZoneId(drawingTargetZoneId || null);
                }, 100);
                
              } else {
                alert('다각형을 구성하기 위해 최소 3개의 점이 꼭 필요합니다.');
              }
            }}
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            그리기 완료
          </button>
          <button 
            onClick={() => {
              if (setIsDrawingMode) setIsDrawingMode(false);
              if (setDrawnPolygon) setDrawnPolygon([]);
              if (setDrawingTargetZoneId) setDrawingTargetZoneId(null);
            }}
            className="flex-1 bg-zinc-200 text-zinc-700 font-bold py-3 rounded-xl hover:bg-zinc-300 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  if (!selectedZone) {
    return (
      <div className="flex flex-col h-full print:block print:h-auto">
        <div className="p-6 border-b border-zinc-200 bg-white sticky top-0 z-10 print:hidden">
          <h2 className="text-xl font-bold text-zinc-900 mb-1">조사된 구역 목록</h2>
          <p className="text-sm text-zinc-500">클릭하여 해당 구역의 세부 데이터를 확인하세요.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-50 print:overflow-visible">
          <div className="space-y-3">
            {data.zones.map((z) => {
              const score = z.final_index as number | null;
              const mainColor = getColorForScore(score);
              const isExpanded = expandedZoneId === z.id;
              
              return (
                <div key={z.id} className={`rounded-xl border overflow-hidden transition-shadow ${isExpanded ? 'border-zinc-300 shadow-md' : 'border-zinc-200 shadow-sm hover:shadow-md'}`}>
                  <button 
                    onClick={() => setExpandedZoneId(isExpanded ? null : z.id)}
                    className="w-full flex items-center justify-between p-4 bg-white text-left transition-colors hover:bg-zinc-50"
                  >
                    <span className="font-medium text-zinc-800">{z.name}</span>
                    <span className="text-sm px-2.5 py-1 rounded-full font-medium" 
                      style={{ 
                        backgroundColor: mainColor + '22', 
                        color: mainColor 
                      }}>
                      {score !== null ? score.toFixed(1) : '산출보류'}
                    </span>
                  </button>
                  
                  {isExpanded && (
                    <div className="bg-zinc-50 border-t border-zinc-100 p-2 space-y-2">
                      {editingZoneId === z.id ? (
                        <div className="p-2 border border-zinc-200 rounded-lg bg-white shadow-inner">
                          <h4 className="text-xs font-bold text-zinc-700 mb-3">하위 구역 편집</h4>
                          <div className="space-y-2 mb-3">
                            {editForm.map((sub, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={sub.name} 
                                  onChange={(e) => handleUpdateSub(idx, 'name', e.target.value)} 
                                  placeholder="구역 이름" 
                                  className="flex-1 text-sm p-1.5 border border-zinc-200 rounded focus:outline-none focus:border-blue-400"
                                />
                                <div 
                                  className="w-16 text-xs p-1.5 border border-zinc-100 bg-zinc-50 rounded text-center font-bold text-zinc-500 cursor-not-allowed"
                                >
                                  {sub.final_index !== null ? Number(sub.final_index).toFixed(1) : '자동'}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => {
                                    setReselectingSubZoneId(sub.id);
                                    if (setIsDrawingMode) setIsDrawingMode(true);
                                    if (setDrawingTargetZoneId) setDrawingTargetZoneId(z.id);
                                    handleSaveSub(z); 
                                  }} className="text-xs text-blue-500 hover:bg-blue-50 p-1.5 rounded font-bold">
                                    ✏️ 재선정
                                  </button>
                                  <button onClick={() => handleRemoveSub(idx)} className="text-xs text-red-500 hover:bg-red-50 p-1.5 rounded font-bold">
                                    🗑️ 삭제
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button 
                            onClick={() => {
                              if (setIsDrawingMode) setIsDrawingMode(true);
                              if (setDrawingTargetZoneId) setDrawingTargetZoneId(z.id);
                              // Save current form state so it's not lost
                              handleSaveSub(z); 
                            }} 
                            className="w-full text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 p-2 rounded mb-3 hover:bg-blue-100 transition-colors"
                          >
                            + 지도에서 하위 구역 그리기
                          </button>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveSub(z)} className="flex-1 bg-blue-600 text-white text-xs font-bold p-2 rounded hover:bg-blue-700 transition-colors">
                              저장
                            </button>
                            <button onClick={() => setEditingZoneId(null)} className="flex-1 bg-zinc-200 text-zinc-700 text-xs font-bold p-2 rounded hover:bg-zinc-300 transition-colors">
                              완료
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* @ts-ignore - subZones might not be in the type strictly yet */}
                          {z.subZones && z.subZones.length > 0 ? (
                            <>
                              {/* @ts-ignore */}
                              {z.subZones.map((sub: any) => {
                                const subScore = sub.final_index as number | null;
                                const subColor = getColorForScore(subScore);
                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => onSelectZone(z.id, sub.id)}
                                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-zinc-100 text-left pl-6 relative hover:border-blue-400 hover:shadow-sm transition-all"
                                  >
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-zinc-300" />
                                    <span className="text-sm text-zinc-700">{sub.name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" 
                                      style={{ 
                                        backgroundColor: subColor + '22', 
                                        color: subColor 
                                      }}>
                                      {subScore !== null ? subScore.toFixed(1) : '-'}
                                    </span>
                                  </button>
                                );
                              })}
                            </>
                          ) : (
                            <div className="text-xs text-zinc-500 text-center py-2">
                              세분화된 구역이 없습니다.
                            </div>
                          )}
                          
                          {(role === 'admin' || (role === 'official' && assignedZoneId === z.id)) && (
                            <button 
                              onClick={() => {handleStartEdit(z)}}
                              className="w-full flex items-center justify-center text-xs text-zinc-600 font-semibold p-2 mt-1 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200 bg-white"
                            >
                              ⚙️ 하위 구역 관리
                            </button>
                          )}
                          
                          <button 
                            onClick={() => onSelectZone(z.id, 'all')}
                            className="w-full flex items-center justify-center text-xs text-blue-600 font-semibold p-2 mt-1 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 bg-white"
                          >
                            {z.name} 전체 상세 데이터 보기 <ChevronRight size={14} className="ml-1" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
  // @ts-ignore
  const selectedSubZone = selectedZone.subZones?.find((s: any) => s.id === selectedSubZoneId) || null;

  const zoneScores = data.categoryScores.filter(cs => displayFacilities.some(f => f.id === cs.facility_id));
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
  let rankingTitle = selectedSubZone ? `${selectedSubZone.name} 전체 시설 접근성 순위` : (selectedSubZoneId === 'unassigned' ? "미지정 구역 전체 시설 접근성 순위" : "전체 시설 접근성 순위");
  let ranking = displayFacilities.map(f => {
    let scores = data.categoryScores.filter(cs => cs.facility_id === f.id && cs.score !== null);
    if (selectedCategory) {
      scores = scores.filter(cs => cs.category === selectedCategory);
      rankingTitle = selectedSubZone ? `${selectedSubZone.name} ${selectedCategory.split('_')[1]} 시설 접근성 순위` : (selectedSubZoneId === 'unassigned' ? `미지정 구역 ${selectedCategory.split('_')[1]} 시설 접근성 순위` : `${selectedCategory.split('_')[1]} 시설 접근성 순위`);
    }
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length : 0;
    return { ...f, avgScore: avg, hasData: scores.length > 0 };
  })
  .filter(f => f.hasData)
  .filter(f => searchTerm ? f.name.toLowerCase().includes(searchTerm.toLowerCase()) : true)
  .sort((a, b) => sortOrder === 'desc' ? b.avgScore - a.avgScore : a.avgScore - b.avgScore);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 border-b border-zinc-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <button 
            onClick={() => {
              if (selectedCategory) setSelectedCategory(null);
              else onBackToZones();
            }}
            className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft size={16} className="mr-1" />
            {selectedCategory ? '전체 카테고리로 돌아가기' : '지도 초기화'}
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Printer size={14} className="mr-1.5" />
            PDF 보고서 인쇄
          </button>
        </div>
        
        {/* Print-only Report Title */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-zinc-800 pb-4">
          <h1 className="text-3xl font-black text-zinc-900">
            {selectedSubZone ? `${selectedSubZone.name} 진단 보고서` : `${selectedZone.name} 총괄 진단 보고서`}
          </h1>
          <p className="text-zinc-500 mt-2">모두의 내일 접근성 진단 시스템</p>
        </div>

        <div className="flex items-end justify-between print:hidden">
          <div>
            <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase mb-1 block">Zone Details</span>
            <h2 className="text-2xl font-bold text-zinc-900">{selectedSubZone ? selectedSubZone.name : selectedZone.name}</h2>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-1">{selectedSubZone ? '구역 넓이지수' : '최종 넓이지수'}</div>
            <div className="text-2xl font-bold" style={{ color: getColorForScore(selectedSubZone ? (selectedSubZone.final_index as number | null) : (selectedZone.final_index as number | null)) }}>
              {selectedSubZone 
                ? (selectedSubZone.final_index !== null ? Number(selectedSubZone.final_index).toFixed(1) : '-')
                : (selectedZone.final_index !== null ? (selectedZone.final_index as number).toFixed(1) : '-')}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1">
        {/* Sub-zones Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-zinc-900">세분화 하위 구역</h3>
            {(role === 'admin' || (role === 'official' && assignedZoneId === selectedZone.id)) && (
              <button 
                onClick={() => {
                  onBackToZones();
                  setTimeout(() => {
                    setExpandedZoneId(selectedZone.id);
                    setEditingZoneId(selectedZone.id);
                    // @ts-ignore
                    setEditForm(selectedZone.subZones ? [...selectedZone.subZones] : []);
                  }, 50);
                }}
                className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-medium hover:bg-blue-100 transition-colors"
              >
                ⚙️ 관리
              </button>
            )}
          </div>
          {/* @ts-ignore */}
          {selectedZone.subZones && selectedZone.subZones.length > 0 ? (
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-2">
              {/* @ts-ignore */}
              {selectedZone.subZones.map((sub: any) => {
                const subScore = sub.final_index as number | null;
                const subColor = getColorForScore(subScore);
                const isSelected = selectedSubZoneId === sub.id;
                return (
                  <button 
                    key={sub.id} 
                    onClick={() => onSelectSubZone && onSelectSubZone(isSelected ? null : sub.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500 ring-opacity-20 transform scale-[1.02]'
                      : 'border-zinc-200 bg-white hover:border-blue-300 hover:shadow-md'
                  }`}
                  >
                    <span className={`font-bold text-sm ${isSelected ? 'text-blue-800' : 'text-zinc-800'}`}>
                      {sub.name} {isSelected && <span className="ml-1 text-xs opacity-70">(선택됨)</span>}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold" 
                      style={{ 
                        backgroundColor: isSelected ? '#3b82f6' : subColor + '22', 
                        color: isSelected ? 'white' : subColor 
                      }}>
                      {subScore !== null ? subScore.toFixed(1) + '점' : '산출보류'}
                    </span>
                  </button>
                );
              })}
              
              {/* Virtual Unassigned Zone Button */}
              <button 
                onClick={() => onSelectSubZone && onSelectSubZone(selectedSubZoneId === 'unassigned' ? null : 'unassigned')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer mt-2 ${
                selectedSubZoneId === 'unassigned'
                  ? 'border-gray-500 bg-gray-50 shadow-md ring-2 ring-gray-500 ring-opacity-20 transform scale-[1.02]'
                  : 'border-zinc-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
              >
                <span className={`font-bold text-sm ${selectedSubZoneId === 'unassigned' ? 'text-gray-800' : 'text-zinc-600'}`}>
                  미지정 구역 {selectedSubZoneId === 'unassigned' && <span className="ml-1 text-xs opacity-70">(선택됨)</span>}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-500">
                  나머지 시설
                </span>
              </button>
            </div>
          ) : (
            <div className="text-sm text-zinc-500 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-center">
              설정된 하위 구역이 없습니다.
            </div>
          )}
        </section>

        {/* Radar Chart Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-zinc-900">카테고리별 접근성 균형</h3>
            {!selectedCategory && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-medium">카테고리를 클릭하세요</span>}
          </div>
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 flex flex-col justify-center">
            <RadarChartComp 
              key={selectedSubZoneId || 'all'}
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

        {/* Facility Ranking & Category Specific Charts */}
        {selectedCategory ? (
          <>
            {/* Category Ranking List */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col mb-4 gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-zinc-900">{rankingTitle}</h3>
                  <span className="text-sm text-zinc-500">조사된 시설 {ranking.length}곳</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <input 
                    type="text" 
                    placeholder="시설명 검색..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg outline-none focus:border-blue-400"
                  />
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium transition-colors whitespace-nowrap"
                  >
                    {sortOrder === 'desc' ? '내림차순 ↓' : '오름차순 ↑'}
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2 print:max-h-none print:overflow-visible">
                {ranking.map((f, i) => {
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

            {/* Specific Category Charts (Custom Visualization) */}
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-500 mt-8 print:hidden">
              <CategorySpecificChart
                category={selectedCategory}
                data={ranking}
              />
            </section>
            
            {/* Print-only: All Category Specific Charts */}
            <section className="hidden print:block mt-8 space-y-8 page-break-before-always">
              <h3 className="text-2xl font-bold text-zinc-900 mb-6 text-center border-b-2 pb-2">카테고리별 맞춤형 시각화 리포트</h3>
              {['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'].map(cat => {
                const catRanking = displayFacilities.map(f => {
                  const scores = data.categoryScores.filter(cs => cs.facility_id === f.id && cs.category === cat && cs.score !== null);
                  const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length : 0;
                  return { ...f, avgScore: avg, hasData: scores.length > 0 };
                }).filter(f => f.hasData).sort((a, b) => b.avgScore - a.avgScore);

                return catRanking.length > 0 ? (
                  <div key={cat} className="page-break-inside-avoid">
                    <CategorySpecificChart category={cat} data={catRanking} />
                  </div>
                ) : null;
              })}
            </section>
          </>
        ) : (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-8">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">종합 시설 접근성 순위</h3>
            <BarChartComp 
              facilities={displayFacilities}
              categoryScores={data.categoryScores}
              selectedCategory="ALL"
              onSelectFacility={onSelectFacility}
            />
          </section>
        )}
      </div>
    </div>
  );
}
