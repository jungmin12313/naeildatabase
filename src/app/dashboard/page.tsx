'use client';

import { useAuth } from '@/contexts/AuthContext';
import mockData from '@/data/mock.json';
import { Download, AlertTriangle, Building2, MapPin, TrendingUp, RefreshCw, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as xlsx from 'xlsx';

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

  // Statistics
  const facilityScores = facilities.map(f => {
    const scores = mockData.categoryScores.filter(s => s.facility_id === f.id && s.score !== null);
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length : 0;
    return { ...f, avgScore: avg };
  });

  const overallAvg = facilityScores.length > 0
    ? facilityScores.reduce((sum, f) => sum + f.avgScore, 0) / facilityScores.length
    : 0;

  const bottomFacilities = [...facilityScores].sort((a, b) => a.avgScore !== b.avgScore ? a.avgScore - b.avgScore : a.name.localeCompare(b.name)).slice(0, 5);

  // Re-diagnosis targets (last_survey_date > 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const reDiagnosisTargets = facilities.filter(f => {
    if (!f.last_survey_date) return true;
    return new Date(f.last_survey_date) < sixMonthsAgo;
  });

  const handleExportExcel = () => {
    // Flatten data for export, including detailed measurements and category scores
    const exportData = facilityScores.map(f => {
      const texts = mockData.diagnosisTexts.filter(t => t.facility_id === f.id);
      const textSummary = texts.map(t => `[${t.category.split('_')[1]}] ${t.text}`).join('\n');
      
      const fScores = mockData.categoryScores.filter(s => s.facility_id === f.id);
      const s1 = fScores.find(s => s.category === 'S1_보행로')?.score;
      const s2 = fScores.find(s => s.category === 'S2_출입구')?.score;
      const s3 = fScores.find(s => s.category === 'S3_화장실')?.score;
      const s4 = fScores.find(s => s.category === 'S4_엘리베이터')?.score;
      const s5 = fScores.find(s => s.category === 'S5_주차장')?.score;

      // Extract specific measurements
      const fMeasurements = mockData.measurements.filter(m => m.facility_id === f.id);
      const measurementsSummary = fMeasurements.map(m => {
        const val = typeof m.value === 'boolean' ? (m.value ? '있음' : '없음') : m.value;
        return `[${m.category.split('_')[1]}] ${m.field_name}: ${val}${m.unit}`;
      }).join('\n');

      return {
        '시설명': f.name,
        '구역': zoneName,
        '시설 유형': f.facility_type,
        '최근 점검일': f.last_survey_date || '미점검',
        '접근성 평균 점수': f.avgScore.toFixed(1),
        '보행로 점수': s1 !== undefined && s1 !== null ? s1.toFixed(1) : '-',
        '출입구 점수': s2 !== undefined && s2 !== null ? s2.toFixed(1) : '-',
        '화장실 점수': s3 !== undefined && s3 !== null ? s3.toFixed(1) : '-',
        '승강기 점수': s4 !== undefined && s4 !== null ? s4.toFixed(1) : '-',
        '주차장 점수': s5 !== undefined && s5 !== null ? s5.toFixed(1) : '-',
        '세부 측정 항목 데이터': measurementsSummary,
        '종합 진단 요약 (AI)': textSummary
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '시설 접근성 통계 및 측정 데이터');
    
    // Auto-size columns slightly
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 40 }, { wch: 60 }
    ];

    xlsx.writeFile(workbook, `공공시설물_접근성_진단데이터_통합_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-8 print:space-y-4">
        
        {/* Print Only Header */}
        <div className="hidden print:block border-b-2 border-zinc-900 pb-4 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-black text-left">공공시설물 접근성 진단<br/>종합 보고서</h1>
            
            {/* 결재란 (Signature Box) */}
            <table className="border-collapse border border-zinc-900 text-center text-xs">
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
          </div>
          <div className="flex justify-between text-sm font-bold mt-2">
            <span>관할 구역: {zoneName}</span>
            <span>출력 일자: {new Date().toLocaleDateString('ko-KR')}</span>
          </div>
        </div>

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center text-blue-600 font-bold mb-2 text-sm tracking-wider">
              {role === 'admin' ? 'SYSTEM ADMIN' : 'OFFICIAL DASHBOARD'}
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">기관 대시보드</h1>
            <p className="text-zinc-500 mt-2 flex items-center">
              <MapPin size={16} className="mr-1" />
              관할 구역: <strong className="ml-1 text-zinc-700">{zoneName}</strong>
            </p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center px-4 py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Printer size={18} className="mr-2" />
              PDF 보고서 출력
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Download size={18} className="mr-2" />
              Excel 추출
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 page-break-avoid print:grid-cols-3">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center print:border-zinc-300">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500">관할 등록 시설</p>
              <p className="text-2xl font-bold text-zinc-900">{facilities.length}개</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mr-4">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500">평균 접근성 점수</p>
              <p className="text-2xl font-bold text-zinc-900">{overallAvg.toFixed(1)}점</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mr-4">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500">재진단 권고 시설 (6개월 경과)</p>
              <p className="text-2xl font-bold text-zinc-900">{reDiagnosisTargets.length}곳</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bottom 5 Facilities */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">우선 개선 필요 시설</h3>
              <span className="text-xs text-zinc-500 font-medium">하위 5곳 (동점 시 가나다순)</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {bottomFacilities.map((f, i) => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
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
              ))}
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

        {/* Print-only Table Summary of all facilities */}
        <div className="hidden print:block mt-8 page-break-avoid">
          <div className="border-b-2 border-zinc-900 pb-2 mb-4 flex items-end justify-between">
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

      </div>
    </div>
  );
}
