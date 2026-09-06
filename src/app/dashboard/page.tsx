'use client';

import { useAuth } from '@/contexts/AuthContext';
import mockData from '@/data/mock.json';
import { Download, AlertTriangle, Building2, MapPin, TrendingUp, RefreshCw, Printer } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { COVERAGE_THRESHOLD } from '@/config/constants';
import RadarChartComp from '@/components/RadarChartComp';
import { getNormalizedCategoryScores } from '@/utils/scoring';

export default function Dashboard() {
  const { role, assignedZoneId } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (role === 'viewer') {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle size={48} className="text-zinc-300 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900">권한이 없습니다</h2>
        <p className="mt-2 text-zinc-500">지자체 담당자 또는 내부 운영자 계정으로 로그인해주세요.</p>
        <p className="mt-4 text-xs text-zinc-400">우측 하단의 Role Switcher를 통해 권한을 변경할 수 있습니다.</p>
      </div>
    );
  }

  // Filter facilities based on role
  const facilities = role === 'official' && assignedZoneId
    ? mockData.facilities.filter(f => f.zone_id === assignedZoneId)
    : mockData.facilities;

  const zoneName = role === 'official' && assignedZoneId
    ? mockData.zones.find(z => z.id === assignedZoneId)?.name
    : '전체 관할 구역';

  const normalizedScores = useMemo(() => {
    return getNormalizedCategoryScores(facilities, mockData.categoryScores);
  }, [facilities, mockData.categoryScores]);

  // Statistics
  const facilityScores = facilities.map(f => {
    const allNormScores = normalizedScores.filter(s => s.facility_id === f.id);
    const measuredCount = allNormScores.filter(s => s.isMeasured).length;
    const avg = allNormScores.length > 0 ? allNormScores.reduce((sum, s) => sum + s.score, 0) / allNormScores.length : 0;
    return { ...f, avgScore: avg, measuredCount, diagnosisTier: measuredCount >= COVERAGE_THRESHOLD ? 'confirmed' : 'preliminary' };
  });

  const confirmedFacilities = facilityScores.filter(f => f.diagnosisTier === 'confirmed');
  const preliminaryFacilities = facilityScores.filter(f => f.diagnosisTier === 'preliminary');

  const overallAvg = confirmedFacilities.length > 0
    ? confirmedFacilities.reduce((sum, f) => sum + f.avgScore, 0) / confirmedFacilities.length
    : 0;

  const bottomFacilities = [...confirmedFacilities].sort((a, b) => a.avgScore !== b.avgScore ? a.avgScore - b.avgScore : a.name.localeCompare(b.name)).slice(0, 5);

  // Re-diagnosis targets (last_survey_date > 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const reDiagnosisTargets = facilities.filter(f => {
    if (!f.last_survey_date) return true;
    return new Date(f.last_survey_date) < sixMonthsAgo;
  });

  const { radarData } = useMemo(() => {
    const scores = normalizedScores.filter(cs => confirmedFacilities.some(f => f.id === cs.facility_id));
    const avgs: Record<string, { total: number, count: number }> = {
      'S1_보행로': { total: 0, count: 0 },
      'S2_출입구': { total: 0, count: 0 },
      'S3_화장실': { total: 0, count: 0 },
      'S4_엘리베이터': { total: 0, count: 0 },
      'S5_주차장': { total: 0, count: 0 },
    };

    scores.forEach(s => {
      if (s.score !== null && avgs[s.category]) {
        avgs[s.category].total += s.score;
        avgs[s.category].count++;
      }
    });

    const radar = Object.keys(avgs).map(cat => {
      const realScore = avgs[cat].count > 0 ? Math.round(avgs[cat].total / avgs[cat].count) : 0;
      return {
        id: cat,
        subject: cat.split('_')[1],
        A: realScore,
        visualA: realScore < 5 ? 5 : realScore, // minimum for rendering
        fullMark: 100
      };
    });

    return { radarData: radar };
  }, [confirmedFacilities, normalizedScores]);

  const coveragePercent = facilities.length > 0 ? Math.round((confirmedFacilities.length / facilities.length) * 100) : 0;

  const handleExportExcel = () => {
    const workbook = xlsx.utils.book_new();

    // 1. 요약 통계 (Summary)
    const gradeDistribution = { 우수: 0, 보통: 0, 미흡: 0 };
    confirmedFacilities.forEach(f => {
      if (f.avgScore >= 80) gradeDistribution['우수']++;
      else if (f.avgScore >= 50) gradeDistribution['보통']++;
      else gradeDistribution['미흡']++;
    });

    const summaryData = [
      { '항목': '관할 구역명', '값': zoneName },
      { '항목': '전체 시설 수', '값': `${facilities.length}개` },
      { '항목': '정밀진단 시설 수', '값': `${confirmedFacilities.length}개` },
      { '항목': '예비조사 시설 수', '값': `${preliminaryFacilities.length}개` },
      { '항목': '측정 커버리지', '값': `${coveragePercent}%` },
      { '항목': '정밀진단 평균 점수', '값': `${overallAvg.toFixed(1)}점` },
      { '항목': '등급 분포 (우수 80+)', '값': `${gradeDistribution['우수']}개` },
      { '항목': '등급 분포 (보통 50-79)', '값': `${gradeDistribution['보통']}개` },
      { '항목': '등급 분포 (미흡 50-)', '값': `${gradeDistribution['미흡']}개` }
    ];
    const ws1 = xlsx.utils.json_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
    xlsx.utils.book_append_sheet(workbook, ws1, '요약통계');

    // 2. 시설상세 (Details)
    const detailsData = facilityScores.map(f => {
      const fScores = normalizedScores.filter(s => s.facility_id === f.id);
      const s1 = fScores.find(s => s.category === 'S1_보행로');
      const s2 = fScores.find(s => s.category === 'S2_출입구');
      const s3 = fScores.find(s => s.category === 'S3_화장실');
      const s4 = fScores.find(s => s.category === 'S4_엘리베이터');
      const s5 = fScores.find(s => s.category === 'S5_주차장');

      return {
        '시설명': f.name,
        '구역': zoneName,
        '시설 유형': f.facility_type,
        '진단 등급': f.diagnosisTier === 'confirmed' ? '정밀진단' : '예비조사',
        '측정 카테고리 수': f.measuredCount,
        '최근 점검일': f.last_survey_date || '미점검',
        '평균 점수': f.avgScore.toFixed(1),
        '보행로 점수': s1 ? s1.score.toFixed(1) + (s1.isMeasured ? '' : ' (대체)') : '-',
        '출입구 점수': s2 ? s2.score.toFixed(1) + (s2.isMeasured ? '' : ' (대체)') : '-',
        '화장실 점수': s3 ? s3.score.toFixed(1) + (s3.isMeasured ? '' : ' (대체)') : '-',
        '승강기 점수': s4 ? s4.score.toFixed(1) + (s4.isMeasured ? '' : ' (대체)') : '-',
        '주차장 점수': s5 ? s5.score.toFixed(1) + (s5.isMeasured ? '' : ' (대체)') : '-'
      };
    });
    const ws2 = xlsx.utils.json_to_sheet(detailsData);
    xlsx.utils.book_append_sheet(workbook, ws2, '시설상세');

    // 3. 세부측정원본 (Raw Measurements)
    const rawData = facilities.flatMap(f => 
      mockData.measurements.filter(m => m.facility_id === f.id).map(m => ({
        '시설명': f.name,
        '카테고리': m.category,
        '측정항목': m.field_name,
        '측정값': typeof m.value === 'boolean' ? (m.value ? '예' : '아니오') : m.value,
        '단위': m.unit || ''
      }))
    );
    const ws3 = xlsx.utils.json_to_sheet(rawData);
    xlsx.utils.book_append_sheet(workbook, ws3, '세부측정원본');

    // 4. AI진단요약 (AI Summaries)
    const aiData = facilities.flatMap(f => 
      mockData.diagnosisTexts.filter(t => t.facility_id === f.id).map(t => ({
        '시설명': f.name,
        '카테고리': t.category,
        'AI 진단 텍스트': t.text.replace('[AI 요약] ', '')
      }))
    );
    const ws4 = xlsx.utils.json_to_sheet(aiData);
    ws4['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 80 }];
    xlsx.utils.book_append_sheet(workbook, ws4, 'AI진단요약');

    xlsx.writeFile(workbook, `공공시설물_접근성_진단데이터_${zoneName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-8 print:space-y-4">
        
        {/* Unified Header (Visible on both Screen and Print) */}
        <div className="border-b-2 border-zinc-900 pb-4 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center text-blue-600 font-bold mb-2 text-sm tracking-wider">
              {role === 'admin' ? 'SYSTEM ADMIN' : 'OFFICIAL DASHBOARD'}
            </div>
            <h1 className="text-3xl font-black text-left text-zinc-900 tracking-tight">
              공공시설물 접근성 진단<br className="hidden print:block" /> 종합 보고서
            </h1>
            <div className="flex space-x-4 text-sm font-bold mt-4 text-zinc-700">
              <span className="flex items-center">
                <MapPin size={16} className="mr-1" /> 관할 구역: {zoneName}
              </span>
              <span className="print:block hidden">
                출력 일자: {new Date().toLocaleDateString('ko-KR')}
              </span>
              <a href="/compare" className="text-blue-600 hover:underline print:hidden flex items-center ml-4">
                다구역 비교 대시보드로 이동 &rarr;
              </a>
            </div>
          </div>
          
          <div className="flex items-end space-x-6">
            {/* 결재란 (Signature Box) - Visible on both as per user request for identical UI */}
            <table className="border-collapse border border-zinc-900 text-center text-xs bg-white">
              <tbody>
                <tr>
                  <th rowSpan={2} className="border border-zinc-900 bg-zinc-100 p-2 w-8">결<br/>재</th>
                  <th className="border border-zinc-900 bg-zinc-50 w-20 py-1">담당</th>
                  <th className="border border-zinc-900 bg-zinc-50 w-20 py-1">팀장</th>
                  <th className="border border-zinc-900 bg-zinc-50 w-20 py-1">과장</th>
                </tr>
                <tr>
                  <td className="border border-zinc-900 h-16"></td>
                  <td className="border border-zinc-900 h-16"></td>
                  <td className="border border-zinc-900 h-16"></td>
                </tr>
              </tbody>
            </table>

            {/* Action Buttons - Hidden on Print */}
            <div className="flex flex-col space-y-2 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex items-center justify-center px-4 py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Printer size={18} className="mr-2" />
                PDF 보고서 출력
              </button>
              <button 
                onClick={handleExportExcel}
                className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Download size={18} className="mr-2" />
                Excel 추출
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 page-break-avoid print:grid-cols-4">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center print:border-zinc-300">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500">관할 등록 시설</p>
              <p className="text-2xl font-bold text-zinc-900">{facilities.length}개</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center print:border-zinc-300">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mr-4">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-semibold text-zinc-500">정밀진단 / 커버리지</p>
              <p className="text-2xl font-bold text-zinc-900">{confirmedFacilities.length}곳 <span className="text-sm font-normal text-zinc-500">({coveragePercent}%)</span></p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mr-4">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-semibold text-zinc-500">평균 점수 <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1 py-0.5 rounded">(정밀 기준)</span></p>
              <p className="text-2xl font-bold text-zinc-900">{overallAvg.toFixed(1)}점</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mr-4">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-semibold text-zinc-500">재진단 권고 (6개월)</p>
              <p className="text-2xl font-bold text-zinc-900">{reDiagnosisTargets.length}곳</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Radar Chart */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col items-center justify-center p-6 print:border-zinc-300">
            <h3 className="text-lg font-bold text-zinc-900 mb-4 self-start">카테고리별 접근성 균형</h3>
            <div className="w-full h-64 relative">
              <RadarChartComp data={radarData} onCategoryClick={() => {}} />
            </div>
          </div>

          {/* Bottom 5 Facilities */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">우선 개선 필요 시설</h3>
              <span className="text-xs text-zinc-500 font-medium">하위 5곳 (동점 시 가나다순)</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {bottomFacilities.map((f, i) => {
                const aiText = mockData.diagnosisTexts.find(t => t.facility_id === f.id)?.text;
                return (
                  <div key={f.id} className="p-4 flex flex-col hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold mr-3">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-900">{f.name}</p>
                          <p className="text-xs text-zinc-500">{f.facility_type}</p>
                        </div>
                      </div>
                      <div className="font-bold text-red-600">
                        {f.avgScore.toFixed(1)}점
                      </div>
                    </div>
                    {aiText && (
                      <div className="text-[11px] text-zinc-500 bg-zinc-100 p-2 rounded ml-9 line-clamp-2 print:line-clamp-none">
                        {aiText.replace('[AI 요약] ', '')}
                      </div>
                    )}
                  </div>
                );
              })}
              {bottomFacilities.length === 0 && (
                <div className="p-8 text-center text-zinc-400">데이터가 없습니다</div>
              )}
            </div>
          </div>

          {/* Re-diagnosis Targets */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden print:border-zinc-300">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between print:border-zinc-300">
              <h3 className="text-lg font-bold text-zinc-900">재진단 대상 목록</h3>
              <span className="text-xs font-semibold px-2 py-1 bg-zinc-100 text-zinc-600 rounded print:bg-transparent print:border print:border-zinc-300">마지막 조사 기준</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto print:max-h-none print:divide-zinc-200">
              {reDiagnosisTargets.map(f => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div>
                    <p className="font-semibold text-zinc-900">{f.name}</p>
                    <p className="text-xs text-zinc-500">최종 점검일: {f.last_survey_date || '알 수 없음'}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-orange-100 text-orange-700 rounded border border-orange-200">
                    진단 요망
                  </span>
                </div>
              ))}
              {reDiagnosisTargets.length === 0 && (
                <div className="p-8 text-center text-zinc-400">재진단 대상이 없습니다</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-8 print:hidden">
          {/* Preliminary Targets (Internal Only) */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">추가 실측 필요 목록 <span className="text-sm font-normal text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">(내부 담당자용)</span></h3>
              <span className="text-xs font-semibold px-2 py-1 bg-zinc-100 text-zinc-600 rounded">측정항목 5개 미만</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
              {facilityScores.filter(f => f.measuredCount < 5).map(f => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div>
                    <p className="font-semibold text-zinc-900">{f.name}</p>
                    <p className="text-xs text-zinc-500">{f.facility_type}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
                    측정 {f.measuredCount}/5
                  </span>
                </div>
              ))}
              {facilityScores.filter(f => f.measuredCount < 5).length === 0 && (
                <div className="p-8 text-center text-zinc-400">대상 시설이 없습니다</div>
              )}
            </div>
          </div>
        </div>

        {/* Table Summary of all facilities (Visible on both Screen and Print) */}
        <div className="block mt-8 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm print:bg-transparent print:p-0 print:border-none print:shadow-none page-break-avoid">
          <div className="border-b-2 border-zinc-100 print:border-zinc-900 pb-4 print:pb-2 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-lg font-bold text-zinc-900">전체 시설 현황 및 카테고리별 요약</h3>
            <div className="flex space-x-3 text-xs font-medium pb-1">
              <div className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-600 rounded-full mr-1.5"></span>우수 (80점 이상)</div>
              <div className="flex items-center"><span className="w-2.5 h-2.5 bg-orange-500 rounded-full mr-1.5"></span>보통 (50~79점)</div>
              <div className="flex items-center"><span className="w-2.5 h-2.5 bg-red-600 rounded-full mr-1.5"></span>미흡 (50점 미만)</div>
            </div>
          </div>
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-zinc-800 bg-zinc-50">
                <th className="py-2 px-2">시설명</th>
                <th className="py-2 px-2">유형</th>
                <th className="py-2 px-2 text-center">보행로</th>
                <th className="py-2 px-2 text-center">출입구</th>
                <th className="py-2 px-2 text-center">화장실</th>
                <th className="py-2 px-2 text-center">승강기</th>
                <th className="py-2 px-2 text-center">주차장</th>
                <th className="py-2 px-2 text-right">평균 점수</th>
              </tr>
            </thead>
            <tbody>
              {facilityScores.map(f => {
                const fScores = mockData.categoryScores.filter(s => s.facility_id === f.id);
                const s1 = fScores.find(s => s.category === 'S1_보행로')?.score;
                const s2 = fScores.find(s => s.category === 'S2_출입구')?.score;
                const s3 = fScores.find(s => s.category === 'S3_화장실')?.score;
                const s4 = fScores.find(s => s.category === 'S4_엘리베이터')?.score;
                const s5 = fScores.find(s => s.category === 'S5_주차장')?.score;

                const getColor = (score: number | null | undefined) => {
                  if (score === null || score === undefined) return 'text-zinc-400';
                  if (score >= 80) return 'text-blue-600';
                  if (score >= 50) return 'text-orange-500';
                  return 'text-red-600';
                };
                
                return (
                  <tr key={f.id} className="border-b border-zinc-200">
                    <td className="py-2 px-2 font-semibold truncate max-w-[140px]">{f.name}</td>
                    <td className="py-2 px-2 text-zinc-600">{f.facility_type}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${getColor(s1)}`}>{s1 !== undefined && s1 !== null ? s1.toFixed(0) : '-'}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${getColor(s2)}`}>{s2 !== undefined && s2 !== null ? s2.toFixed(0) : '-'}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${getColor(s3)}`}>{s3 !== undefined && s3 !== null ? s3.toFixed(0) : '-'}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${getColor(s4)}`}>{s4 !== undefined && s4 !== null ? s4.toFixed(0) : '-'}</td>
                    <td className={`py-2 px-2 text-center font-semibold ${getColor(s5)}`}>{s5 !== undefined && s5 !== null ? s5.toFixed(0) : '-'}</td>
                    <td className={`py-2 px-2 text-right font-black ${getColor(f.avgScore)}`}>{f.avgScore.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Appendix: Raw Measurements for Top 5 & Re-diagnosis */}
        <div className="mt-12 pt-8 border-t-2 border-zinc-900 print:mt-8 page-break-before-always">
          <h2 className="text-2xl font-black text-zinc-900 mb-6">부록: 주요 관심 시설 세부 실측 데이터</h2>
          
          <div className="space-y-8">
            {[...bottomFacilities, ...reDiagnosisTargets].filter((f, i, arr) => arr.findIndex(t => t.id === f.id) === i).map(f => {
              const measurements = mockData.measurements.filter(m => m.facility_id === f.id);
              if (measurements.length === 0) return null;
              
              return (
                <div key={f.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden print:border-zinc-400 page-break-avoid">
                  <div className="bg-zinc-100 px-4 py-3 border-b border-zinc-200 print:bg-zinc-200 print:border-zinc-400">
                    <h4 className="font-bold text-zinc-900">{f.name} <span className="text-xs font-normal text-zinc-600 ml-2">{f.facility_type}</span></h4>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 print:border-zinc-300">
                        <th className="px-4 py-2 w-1/4">카테고리</th>
                        <th className="px-4 py-2 w-1/4">측정 항목</th>
                        <th className="px-4 py-2 w-1/2">측정값</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 print:divide-zinc-200">
                      {measurements.map(m => (
                        <tr key={m.id}>
                          <td className="px-4 py-2 font-medium text-zinc-700">{m.category.split('_')[1]}</td>
                          <td className="px-4 py-2 text-zinc-600">{m.field_name}</td>
                          <td className="px-4 py-2 font-bold">{typeof m.value === 'boolean' ? (m.value ? '예' : '아니오') : `${m.value}${m.unit || ''}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
