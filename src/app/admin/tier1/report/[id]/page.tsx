'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import mockDataRaw from '@/data/mock.json';
import tier1Mock from '@/data/tier1_mock.json';

export default function Tier1Report({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const detail = tier1Mock.facilities_details.find(d => d.id === id);

  if (!detail) {
    return <div className="p-8 text-center text-zinc-500">리포트 데이터를 찾을 수 없습니다.</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const totalApplicable = detail.master_db_results.filter(r => r.is_applicable).length;
  const totalMeasured = detail.master_db_results.filter(r => r.is_applicable && r.measured_value !== '미측정').length;
  const totalPass = detail.master_db_results.filter(r => r.is_applicable && r.status === '적합').length;
  const totalFail = detail.master_db_results.filter(r => r.is_applicable && r.status === '부적합').length;

  const completionRate = totalApplicable > 0 ? Math.round((totalMeasured / totalApplicable) * 100) : 0;
  
  const totalBudget = detail.budget.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      
      {/* 툴바 (인쇄 시 숨김) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden">
        <Link href="/admin/tier1">
          <button className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900">
            <ArrowLeft size={16} /> 목록으로 돌아가기
          </button>
        </Link>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Printer size={16} /> PDF 출력 / 인쇄
        </button>
      </div>

      {/* A4 용지 컨테이너 */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-xl min-h-[297mm] print:shadow-none print:w-full print:max-w-none text-zinc-900 leading-relaxed text-sm">
        
        {/* ================= 표지 (Cover Page) ================= */}
        <div className="p-12 flex flex-col min-h-[297mm] relative page-break-after-always">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4">
            <div>
              <div className="text-xl font-bold tracking-tighter text-indigo-900">모두의내일</div>
              <div className="text-xs text-zinc-500 mt-1 font-bold">Tier 1 | Mini Diagnostic Report</div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <p>문서번호: {detail.doc_number}</p>
              <p>발행일자: {detail.overview.report_date}</p>
            </div>
          </div>

          {/* 결재란 */}
          <div className="flex justify-end mt-8">
            <table className="border-collapse border border-zinc-400 text-center text-xs">
              <tbody>
                <tr>
                  <td rowSpan={2} className="border border-zinc-400 bg-zinc-100 font-bold px-2 py-4">결<br/>재</td>
                  <td className="border border-zinc-400 bg-zinc-50 px-6 py-1">담 당</td>
                  <td className="border border-zinc-400 bg-zinc-50 px-6 py-1">팀 장</td>
                  <td className="border border-zinc-400 bg-zinc-50 px-6 py-1">과 장</td>
                </tr>
                <tr>
                  <td className="border border-zinc-400 h-16"></td>
                  <td className="border border-zinc-400 h-16"></td>
                  <td className="border border-zinc-400 h-16"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Title Area */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-20">
            <h2 className="text-3xl font-extrabold text-center leading-tight mb-4 text-zinc-800">
              {detail.overview.name}
            </h2>
            <h1 className="text-5xl font-black text-center leading-tight tracking-tight text-indigo-900 mb-6">
              장애인시설 접근성 실태 진단보고서
            </h1>
            <div className="px-6 py-2 border-2 border-indigo-900 rounded-full text-indigo-900 font-bold tracking-widest text-sm">
              Tier 1 | Mini Diagnostic Report (교통약자법 시행규칙 별표1~3 전 항목 대상)
            </div>
          </div>

          {/* Footer Area */}
          <div className="mt-auto border-t border-zinc-200 pt-8 flex justify-between items-end">
            <div>
              <p className="font-bold text-lg">{detail.overview.name}</p>
              <p className="text-zinc-500">{detail.overview.address}</p>
            </div>
            <div className="text-right font-bold text-indigo-900 text-xl tracking-widest">
              주식회사 모두의내일
            </div>
          </div>
        </div>


        {/* ================= 본문 (Main Content) ================= */}
        <div className="p-12">
          
          {/* 1. 진단 개요 */}
          <section className="mb-12 page-break-inside-avoid">
            <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-4">1. 진단 개요</h2>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left w-32">대상 시설명</th>
                  <td className="border border-zinc-300 px-4 py-2 font-bold">{detail.overview.name}</td>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left w-32">실측 일자</th>
                  <td className="border border-zinc-300 px-4 py-2">{detail.overview.survey_date}</td>
                </tr>
                <tr>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">소재지</th>
                  <td colSpan={3} className="border border-zinc-300 px-4 py-2">{detail.overview.address}</td>
                </tr>
                <tr>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">부속시설 현황</th>
                  <td colSpan={3} className="border border-zinc-300 px-4 py-2">{detail.overview.sub_facilities}</td>
                </tr>
                <tr>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">적용 법령</th>
                  <td className="border border-zinc-300 px-4 py-2">{detail.overview.law}</td>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">실측 도구</th>
                  <td className="border border-zinc-300 px-4 py-2">{detail.overview.survey_tool}</td>
                </tr>
                <tr>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">진단 목적</th>
                  <td colSpan={3} className="border border-zinc-300 px-4 py-2">{detail.overview.purpose}</td>
                </tr>
                <tr>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">작성 기관</th>
                  <td className="border border-zinc-300 px-4 py-2">{detail.overview.author}</td>
                  <th className="border border-zinc-300 bg-zinc-100 px-4 py-2 text-left">발행 일자</th>
                  <td className="border border-zinc-300 px-4 py-2">{detail.overview.report_date}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 2. 종합 진단 결과 요약 */}
          <section className="mb-12 page-break-inside-avoid">
            <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-4">2. 종합 진단 결과 요약</h2>
            
            <div className="grid grid-cols-4 gap-0 border-2 border-indigo-900 rounded-lg overflow-hidden mb-6 text-center">
              <div className="bg-indigo-50 border-r border-indigo-200 p-4">
                <div className="text-xs text-indigo-800 font-bold mb-2">적용대상 항목</div>
                <div className="text-2xl font-bold text-indigo-900">{totalApplicable}건</div>
              </div>
              <div className="bg-indigo-50 border-r border-indigo-200 p-4">
                <div className="text-xs text-indigo-800 font-bold mb-2">실측 완료율</div>
                <div className="text-2xl font-bold text-indigo-900">{completionRate}%</div>
              </div>
              <div className="bg-indigo-50 border-r border-indigo-200 p-4">
                <div className="text-xs text-indigo-800 font-bold mb-2">적합 / 부적합</div>
                <div className="text-xl font-bold text-indigo-900"><span className="text-green-600">{totalPass}</span> / <span className="text-red-600">{totalFail}</span></div>
              </div>
              <div className="bg-indigo-900 p-4 flex flex-col justify-center">
                <div className="text-xs text-indigo-200 font-bold mb-1">종합 판정</div>
                <div className="text-xl font-bold text-white">
                  {totalFail === 0 ? '양호 (적합)' : '개선 요망'}
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-lg">
              <h3 className="font-bold mb-3 text-zinc-900">📌 핵심 결함 요약</h3>
              <ul className="list-disc pl-5 space-y-2 text-zinc-700">
                {detail.improvements.map((imp, idx) => (
                  <li key={idx}><span className="font-bold">{imp.item}:</span> {imp.problem}</li>
                ))}
                {detail.improvements.length === 0 && <li>발견된 핵심 결함이 없습니다.</li>}
              </ul>
            </div>
          </section>


          {/* 3. 항목별 상세 실측 결과 */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-2">3. 항목별 상세 실측 결과 (전체 적용항목 대상)</h2>
            <p className="text-xs text-zinc-500 font-medium mb-4">
              * 지역/유형 요약점수(S1~S5 5대 카테고리)가 아닌, 시행규칙 별표1~3 규격마스터DB 중 대상 시설에 실제 적용되는 핵심 항목 전체를 단답형으로 나열함
            </p>
            <table className="w-full border-collapse text-sm mb-4">
              <thead className="bg-zinc-100 border-t-2 border-b-2 border-zinc-400">
                <tr>
                  <th className="px-2 py-3 text-center">대분류</th>
                  <th className="px-2 py-3 text-left">세부항목</th>
                  <th className="px-2 py-3 text-left">실측값</th>
                  <th className="px-2 py-3 text-left">법정기준</th>
                  <th className="px-2 py-3 text-center">판정</th>
                  <th className="px-2 py-3 text-left">근거조문</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {detail.master_db_results.map((res, idx) => (
                  <tr key={idx} className={!res.is_applicable ? 'bg-zinc-50 text-zinc-500' : ''}>
                    <td className="px-2 py-3 text-center font-medium">{res.category}</td>
                    <td className="px-2 py-3 font-bold">{res.item}</td>
                    <td className="px-2 py-3">{res.measured_value}</td>
                    <td className="px-2 py-3 text-xs">{res.legal_standard}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        res.status === '적합' ? 'bg-green-100 text-green-700' : 
                        res.status === '부적합' ? 'bg-red-100 text-red-700' : 
                        'bg-zinc-200 text-zinc-600'
                      }`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs">{res.law_ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 해당없음 사유 */}
            {detail.master_db_results.filter(r => !r.is_applicable).length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 p-4 rounded text-xs text-zinc-600">
                <span className="font-bold text-zinc-800">※ &apos;해당없음&apos; 판정 사유 (시설 적용성 매트릭스 판정 근거):</span>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {detail.master_db_results.filter(r => !r.is_applicable).map((r, i) => (
                    <li key={i}>[{r.item}] {r.na_reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 4. 미준수 항목 개선 가이드 */}
          {detail.improvements.length > 0 && (
            <section className="mb-12 page-break-before-always">
              <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-4">4. 미준수 항목 개선 가이드</h2>
              <div className="space-y-4">
                {detail.improvements.map((imp, idx) => (
                  <div key={idx} className="border border-red-200 rounded-lg overflow-hidden page-break-inside-avoid">
                    <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex justify-between items-center">
                      <h3 className="font-bold text-red-900 text-base">{imp.item}</h3>
                      <span className="text-xs font-mono text-red-700 bg-red-100 px-2 py-1 rounded">{imp.law_ref}</span>
                    </div>
                    <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-500 mb-1">■ 현장 문제점</h4>
                        <p className="text-sm text-zinc-900">{imp.problem}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-blue-600 mb-1">■ 개선 가이드</h4>
                        <p className="text-sm text-zinc-900">{imp.guide}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 5. 개략 예산 산출 근거 */}
          <section className="mb-12 page-break-inside-avoid">
            <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-4">5. 개략 예산 산출 근거</h2>
            <table className="w-full border-collapse text-sm mb-2">
              <thead className="bg-zinc-100 border-t-2 border-b border-zinc-400">
                <tr>
                  <th className="px-3 py-3 text-left">개선 항목</th>
                  <th className="px-3 py-3 text-center">규격/수량</th>
                  <th className="px-3 py-3 text-right">단가 (원)</th>
                  <th className="px-3 py-3 text-left">산출 근거</th>
                  <th className="px-3 py-3 text-right">개략 공사비 (원)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {detail.budget.map((b, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3 font-medium">{b.item}</td>
                    <td className="px-3 py-3 text-center">{b.quantity}</td>
                    <td className="px-3 py-3 text-right">{b.unit_price.toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{b.basis}</td>
                    <td className="px-3 py-3 text-right font-medium">{b.total.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-zinc-50 border-t-2 border-zinc-400">
                  <td colSpan={4} className="px-3 py-3 font-bold text-center">총 합계 (부가세 별도)</td>
                  <td className="px-3 py-3 text-right font-bold text-lg text-indigo-900">{totalBudget.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-zinc-500 text-right">※ 아래 견적은 부적합 항목 {totalFail}개소에 대한 개략 공사비이며 실제 시공 견적과 상이할 수 있음</p>
          </section>

          {/* 6. 현장 사진 */}
          <section className="mb-12 page-break-before-always">
            <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-6">6. 현장 사진</h2>
            <div className="grid grid-cols-2 gap-6">
              {detail.photos.map((photo, i) => (
                <div key={i} className="flex flex-col border border-zinc-200 rounded bg-white page-break-inside-avoid">
                  <div className="aspect-video bg-zinc-100 flex items-center justify-center overflow-hidden border-b border-zinc-200 relative">
                    <span className="text-zinc-400 text-xs absolute">이미지 불러오는 중...</span>
                    <img src={photo.url} alt="현장 사진" className="w-full h-full object-cover z-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <div className="p-3 text-center text-sm font-medium text-zinc-800">
                    {photo.caption}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. 결론 및 권고사항 */}
          <section className="mb-12 page-break-inside-avoid">
            <h2 className="text-xl font-bold text-indigo-900 border-b-2 border-indigo-900 pb-2 mb-4">7. 결론 및 권고사항</h2>
            <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-lg">
              <p className="text-zinc-800 leading-relaxed whitespace-pre-line">
                {detail.conclusion}
              </p>
            </div>
          </section>

          {/* 부록 */}
          <section className="page-break-before-always text-xs text-zinc-600 space-y-8">
            <h2 className="text-lg font-bold text-zinc-400 border-b border-zinc-200 pb-2 mb-4">부록</h2>
            
            <div>
              <h3 className="font-bold text-zinc-800 mb-2">A. 실측 기기 및 측정 방법</h3>
              <p className="leading-relaxed">본 보고서에 기재된 측정값은 레이저 거리측정기(오차범위 ±1mm), 디지털 수평기, 경사계 등을 사용하여 정밀하게 실측되었습니다. 측정은 휠체어 사용자의 실제 동선을 기준으로 이루어졌으며, 단차의 경우 가장 높은 지점을 기준으로 측정하였습니다.</p>
            </div>

            <div>
              <h3 className="font-bold text-zinc-800 mb-2">B. 적용대상 항목 선별(Screening) 로직 설명</h3>
              <p className="leading-relaxed">본 진단은 98개 규격마스터DB 중 대상 시설의 유형(근린생활시설, 판매시설 등), 규모(바닥면적), 부속시설 존치 여부에 따라 법적 설치 의무가 있는 항목만을 선별(Screening)하여 진단하였습니다. &apos;해당없음&apos;으로 분류된 항목은 설치 의무가 없거나 물리적으로 존재하지 않는 시설입니다.</p>
            </div>

            <div>
              <h3 className="font-bold text-zinc-800 mb-2">C. 근거 법령 발췌</h3>
              <p className="leading-relaxed">
                - 장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 별표 1 (편의시설의 구조·재질 등에 관한 세부기준)<br/>
                - 법률 제4조 및 제7조에 따른 편의시설 설치 대상 기준 적용
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
