'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import mockDataRaw from '@/data/mock.json';
import { COVERAGE_THRESHOLD } from '@/config/constants';
import * as xlsx from 'xlsx';
import { Printer, Download, MapPin, AlertTriangle, Building2, Layers, CheckSquare, Square } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getNormalizedCategoryScores, getZoneRadarData } from '@/utils/scoring';

export default function CompareDashboard() {
  const { role, assignedZoneId, isAuthLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zonesData, setZonesData] = useState<any[]>([]);

  useEffect(() => {
    const localZones = localStorage.getItem('naeil_zonesData');
    if (localZones) {
      try { setZonesData(JSON.parse(localZones)); } catch(e) { setZonesData(mockDataRaw.zones); }
    } else {
      setZonesData(mockDataRaw.zones);
    }
    setMounted(true);
  }, []);

  const mockData = { ...mockDataRaw, zones: zonesData.length > 0 ? zonesData : mockDataRaw.zones };

  const handleZoneToggle = (zoneId: string) => {
    setSelectedZoneIds(prev => {
      if (prev.includes(zoneId)) return prev.filter(id => id !== zoneId);
      if (prev.length >= 4) {
        alert("최대 4개까지만 비교 가능합니다.");
        return prev;
      }
      return [...prev, zoneId];
    });
  };

  const selectedZonesInfo = useMemo(() => {
    return selectedZoneIds.map(zid => {
      let zoneName = mockData.zones.find(z => z.id === zid)?.name;
      const isSubZone = !zoneName && mockData.zones.some(z => z.subZones?.some((sz: any) => sz.id === zid));
      
      let zoneFacilities: any[] = [];
      let displayName = zoneName || '알 수 없음';

      if (isSubZone) {
        const parentZone = mockData.zones.find(z => z.subZones?.some((sz: any) => sz.id === zid));
        const sz = parentZone?.subZones?.find((s: any) => s.id === zid);
        displayName = sz?.name || '알 수 없음';
        zoneFacilities = mockData.facilities.filter(f => (f as any).sub_zone_id === zid || (f.zone_id === parentZone?.id && sz?.name === '전대후문' /* fallback */));
      } else {
        zoneFacilities = mockData.facilities.filter(f => f.zone_id === zid);
      }
      
      const normalizedScores = getNormalizedCategoryScores(zoneFacilities, mockData.categoryScores);

      const facilityScores = zoneFacilities.map(f => {
        const scores = mockData.categoryScores.filter(s => s.facility_id === f.id && s.score !== null);
        const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length : 0;
        return { ...f, avgScore: avg, measuredCount: scores.length, diagnosisTier: scores.length >= COVERAGE_THRESHOLD ? 'confirmed' : 'preliminary' };
      });

      const confirmed = facilityScores.filter(f => f.diagnosisTier === 'confirmed');
      const coverage = zoneFacilities.length > 0 ? Math.round((confirmed.length / zoneFacilities.length) * 100) : 0;
      const overallAvg = confirmed.length > 0 ? confirmed.reduce((sum, f) => sum + f.avgScore, 0) / confirmed.length : 0;

      const radarForZone = getZoneRadarData(confirmed, mockData.categoryScores);
      const catScores: Record<string, number> = {};
      radarForZone.forEach(r => {
        catScores[r.id] = r.A;
      });

      return { id: zid, name: displayName, facilities: zoneFacilities, confirmed, coverage, overallAvg, catScores };
    });
  }, [selectedZoneIds, mockData]);

  const radarData = useMemo(() => {
    const categories = ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'];
    return categories.map(cat => {
      const row: any = { subject: cat.split('_')[1], fullMark: 100 };
      selectedZonesInfo.forEach(zi => {
        row[zi.name] = zi.catScores[cat];
      });
      return row;
    });
  }, [selectedZonesInfo]);

  const gapData = useMemo(() => {
    if (selectedZonesInfo.length < 2) return [];
    const categories = ['S1_보행로', 'S2_출입구', 'S3_화장실', 'S4_엘리베이터', 'S5_주차장'];
    return categories.map(cat => {
      let maxScore = -1, minScore = 101, maxZone = '', minZone = '';
      selectedZonesInfo.forEach(zi => {
        const score = zi.catScores[cat];
        if (score > maxScore) { maxScore = score; maxZone = zi.name; }
        if (score < minScore) { minScore = score; minZone = zi.name; }
      });
      const gap = maxScore - minScore;
      return { category: cat.split('_')[1], maxZone, maxScore, minZone, minScore, gap, isCritical: gap >= 20 };
    });
  }, [selectedZonesInfo]);

  const integratedTop5 = useMemo(() => {
    const allConfirmed = selectedZonesInfo.flatMap(zi => zi.confirmed.map(f => ({ ...f, zoneName: zi.name })));
    return allConfirmed.sort((a, b) => a.avgScore - b.avgScore).slice(0, 5);
  }, [selectedZonesInfo]);

  const handleExportExcel = () => {
    const workbook = xlsx.utils.book_new();

    // 1. 구역비교요약
    const summaryData = selectedZonesInfo.map(zi => ({
      '구역명': zi.name,
      '전체 시설 수': zi.facilities.length,
      '정밀진단 시설 수': zi.confirmed.length,
      '커버리지 (%)': zi.coverage,
      '평균 점수': zi.overallAvg.toFixed(1)
    }));
    const ws1 = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(workbook, ws1, '구역비교요약');

    // 2. 격차분석
    const gapWsData = gapData.map(g => ({
      '카테고리': g.category,
      '최고 구역': g.maxZone,
      '최고 점수': g.maxScore,
      '최저 구역': g.minZone,
      '최저 점수': g.minScore,
      '격차': g.gap,
      '위험(20점이상)': g.isCritical ? '주의' : ''
    }));
    const ws2 = xlsx.utils.json_to_sheet(gapWsData);
    xlsx.utils.book_append_sheet(workbook, ws2, '격차분석');

    // 3. 시설상세_전체
    const allConfirmed = selectedZonesInfo.flatMap(zi => zi.confirmed.map(f => ({
      '구역명': zi.name,
      '시설명': f.name,
      '시설 유형': f.facility_type,
      '평균 점수': f.avgScore.toFixed(1)
    })));
    const ws3 = xlsx.utils.json_to_sheet(allConfirmed);
    xlsx.utils.book_append_sheet(workbook, ws3, '시설상세_전체');

    // 4. 세부측정원본_전체
    const rawData = selectedZonesInfo.flatMap(zi => 
      zi.confirmed.flatMap(f => 
        mockData.measurements.filter(m => m.facility_id === f.id).map(m => ({
          '구역명': zi.name,
          '시설명': f.name,
          '카테고리': m.category,
          '측정항목': m.field_name,
          '측정값': typeof m.value === 'boolean' ? (m.value ? '예' : '아니오') : m.value,
          '단위': m.unit || ''
        }))
      )
    );
    const ws4 = xlsx.utils.json_to_sheet(rawData);
    xlsx.utils.book_append_sheet(workbook, ws4, '세부측정원본_전체');

    // 5. AI진단요약_전체
    const aiData = selectedZonesInfo.flatMap(zi => 
      zi.confirmed.flatMap(f => 
        mockData.diagnosisTexts.filter(t => t.facility_id === f.id).map(t => ({
          '구역명': zi.name,
          '시설명': f.name,
          '카테고리': t.category,
          'AI 진단 텍스트': t.text.replace('[AI 요약] ', '')
        }))
      )
    );
    const ws5 = xlsx.utils.json_to_sheet(aiData);
    ws5['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 80 }];
    xlsx.utils.book_append_sheet(workbook, ws5, 'AI진단요약_전체');

    xlsx.writeFile(workbook, `공공시설물_접근성_다구역비교_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706'];

  if (!mounted || !isAuthLoaded) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500">
        <p className="mb-4 text-lg">권한 확인 중...</p>
      </div>
    );
  }

  if (role === 'viewer') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle size={48} className="text-zinc-300 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900">권한이 없습니다</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-8 print:space-y-4">
        
        <div className="border-b-2 border-zinc-900 pb-4 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center text-blue-600 font-bold mb-2 text-sm tracking-wider">
              <a href="/dashboard" className="text-zinc-500 hover:text-zinc-900 mr-4 print:hidden">&larr; 단일 구역 대시보드</a>
              MULTI-ZONE COMPARE
            </div>
            <h1 className="text-3xl font-black text-left text-zinc-900 tracking-tight">
              다구역 비교 대시보드
            </h1>
          </div>
          
          <div className="flex items-end space-x-6 print:hidden">
            <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg">
              <Printer size={16} className="mr-2" /> PDF 출력
            </button>
            <button onClick={handleExportExcel} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg">
              <Download size={16} className="mr-2" /> 엑셀 다운로드
            </button>
          </div>
        </div>

        {/* Zone Selector */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
          <h3 className="text-lg font-bold text-zinc-900 mb-4">비교 구역 선택 <span className="text-sm font-normal text-zinc-500 ml-2">(2~4개 선택)</span></h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mockData.zones.map(z => (
              <div key={z.id} className="border border-zinc-100 rounded-lg p-3 bg-zinc-50">
                <button 
                  onClick={() => handleZoneToggle(z.id)}
                  className="flex items-center w-full text-left font-bold text-zinc-800 mb-2 hover:text-blue-600"
                >
                  {selectedZoneIds.includes(z.id) ? <CheckSquare size={18} className="mr-2 text-blue-600" /> : <Square size={18} className="mr-2 text-zinc-400" />}
                  {z.name}
                </button>
                <div className="pl-6 space-y-2">
                  {z.subZones?.map((sz: any) => (
                    <button 
                      key={sz.id}
                      onClick={() => handleZoneToggle(sz.id)}
                      className="flex items-center w-full text-left text-sm text-zinc-600 hover:text-blue-600"
                    >
                      {selectedZoneIds.includes(sz.id) ? <CheckSquare size={16} className="mr-2 text-blue-600" /> : <Square size={16} className="mr-2 text-zinc-300" />}
                      {sz.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedZonesInfo.length < 2 && (
          <div className="bg-orange-50 text-orange-700 p-8 rounded-2xl border border-orange-100 text-center font-bold print:hidden">
            비교할 구역을 2개 이상 선택해주세요.
          </div>
        )}

        {selectedZonesInfo.length >= 2 && (
          <>
            <div className={`grid grid-cols-1 md:grid-cols-${selectedZonesInfo.length} gap-4 page-break-avoid`}>
              {selectedZonesInfo.map((zi, idx) => (
                <div key={zi.id} className="bg-white p-5 rounded-2xl border-t-4 shadow-sm print:border-zinc-300 print:border-t-4" style={{ borderTopColor: colors[idx % colors.length] }}>
                  <h4 className="text-xl font-black text-zinc-900">{zi.name}</h4>
                  <div className="mt-4 flex justify-between items-end">
                    <div>
                      <p className="text-xs text-zinc-500">평균 점수</p>
                      <p className="text-2xl font-bold" style={{ color: colors[idx % colors.length] }}>{zi.overallAvg.toFixed(1)}점</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">커버리지</p>
                      <p className="text-sm font-bold text-zinc-700">{zi.coverage}% ({zi.confirmed.length}곳)</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 page-break-avoid print:grid-cols-2">
              <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center print:border-zinc-300">
                <h3 className="font-bold mb-4 self-start">카테고리별 다중 레이더 차트</h3>
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      {selectedZonesInfo.map((zi, idx) => (
                        <Radar key={zi.id} name={zi.name} dataKey={zi.name} stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.3} />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center print:border-zinc-300">
                <h3 className="font-bold mb-4 self-start">구역별 비교 막대 차트</h3>
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={radarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      {selectedZonesInfo.map((zi, idx) => (
                        <Bar key={zi.id} dataKey={zi.name} name={zi.name} fill={colors[idx % colors.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden page-break-avoid print:border-zinc-300">
              <div className="p-4 border-b bg-zinc-50 print:bg-zinc-100 print:border-zinc-300"><h3 className="font-bold">격차(Gap) 분석</h3></div>
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="bg-zinc-100 border-b print:bg-zinc-200 print:border-zinc-300">
                    <th className="p-3">카테고리</th>
                    <th className="p-3">최고 구역 (점수)</th>
                    <th className="p-3">최저 구역 (점수)</th>
                    <th className="p-3">격차 (Gap)</th>
                  </tr>
                </thead>
                <tbody className="divide-y print:divide-zinc-200">
                  {gapData.map(g => (
                    <tr key={g.category} className={g.isCritical ? 'bg-red-50/50 print:bg-red-50' : ''}>
                      <td className="p-3 font-bold">{g.category}</td>
                      <td className="p-3 text-blue-600">{g.maxZone} ({g.maxScore})</td>
                      <td className="p-3 text-red-600">{g.minZone} ({g.minScore})</td>
                      <td className={`p-3 font-black ${g.isCritical ? 'text-red-600' : 'text-zinc-700'}`}>{g.gap}점</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-12 page-break-avoid print:border-zinc-300">
              <div className="p-4 border-b bg-zinc-50 print:bg-zinc-100 print:border-zinc-300"><h3 className="font-bold">통합 우선 개선 필요 시설 (하위 5곳)</h3></div>
              <div className="divide-y print:divide-zinc-200">
                {integratedTop5.map((f, i) => {
                  const aiText = mockData.diagnosisTexts.find(t => t.facility_id === f.id)?.text;
                  return (
                    <div key={f.id} className="p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <span className="w-6 h-6 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold mr-4 print:border print:border-red-200">{i + 1}</span>
                          <div>
                            <div className="font-bold">{f.name} <span className="text-xs text-zinc-500 ml-2">{f.facility_type}</span></div>
                            <div className="text-xs text-blue-600 font-medium">{f.zoneName}</div>
                          </div>
                        </div>
                        <div className="font-black text-red-600">{f.avgScore.toFixed(1)}점</div>
                      </div>
                      {aiText && (
                        <div className="text-[11px] text-zinc-500 bg-zinc-100 p-2 rounded ml-10 print:bg-zinc-50 print:border print:border-zinc-200">
                          {aiText.replace('[AI 요약] ', '')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
