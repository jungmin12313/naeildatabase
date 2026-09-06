'use client';

import { Users, FileDown } from 'lucide-react';

export default function Tier2Dashboard() {
  const workshops = [
    { id: 'w1', date: '2026-09-15', org: 'A대학교', title: '청년 데이터 플로깅 프로젝트', status: '예정', participants: 45 },
    { id: 'w2', date: '2026-08-20', org: 'B기업 ESG팀', title: '기업 임직원 휠체어 매핑 워크숍', status: '완료', participants: 30 },
  ];

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Tier 2. 워크숍</h1>
        <p className="text-zinc-500 mt-1">참여형 강연 일정 관리 및 AppSheet 간소화 폼 데이터 취합 모듈입니다.</p>
      </header>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
          <h2 className="font-bold text-zinc-800">워크숍 일정 현황</h2>
          <button className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800">
            신규 워크숍 등록
          </button>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 bg-zinc-100 uppercase border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4">일자</th>
              <th className="px-6 py-4">참가기관</th>
              <th className="px-6 py-4">워크숍명</th>
              <th className="px-6 py-4">참가자 수</th>
              <th className="px-6 py-4">상태</th>
              <th className="px-6 py-4 text-right">AppSheet 데이터</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {workshops.map(w => (
              <tr key={w.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium">{w.date}</td>
                <td className="px-6 py-4">{w.org}</td>
                <td className="px-6 py-4 font-medium text-zinc-900">{w.title}</td>
                <td className="px-6 py-4">{w.participants}명</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${w.status === '완료' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 hover:bg-zinc-50 text-xs">
                    <FileDown size={14} /> 취합 엑셀 다운로드
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
