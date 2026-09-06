'use client';

import { Bell, Repeat } from 'lucide-react';
import { useState, useEffect } from 'react';
import mockDataRaw from '@/data/mock.json';

export default function Tier5Dashboard() {
  const [targets, setTargets] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const filtered = mockDataRaw.facilities.filter(f => {
      if (!f.last_survey_date) return true;
      return new Date(f.last_survey_date) < sixMonthsAgo;
    });
    setTargets(filtered);
  }, []);

  if (!mounted) return null;

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Tier 5. 구독 모니터링</h1>
        <p className="text-zinc-500 mt-1">연간 갱신 데이터 축적 및 구역별 최신 갱신일 알림(재조사 큐) 기능입니다.</p>
      </header>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
          <h2 className="font-bold text-zinc-800 flex items-center gap-2">
            <Bell size={18} className="text-amber-500" />
            재조사 알림 큐 (6개월 경과 시설)
          </h2>
          <span className="text-sm font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
            총 {targets.length}건
          </span>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 bg-zinc-100 uppercase border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4">시설명</th>
              <th className="px-6 py-4">유형</th>
              <th className="px-6 py-4">최근 점검일</th>
              <th className="px-6 py-4">경과 기간</th>
              <th className="px-6 py-4 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {targets.map(f => {
              const diffTime = Math.abs(new Date().getTime() - new Date(f.last_survey_date || '2020-01-01').getTime());
              const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
              return (
                <tr key={f.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 font-bold text-zinc-900">{f.name}</td>
                  <td className="px-6 py-4 text-zinc-500">{f.facility_type}</td>
                  <td className="px-6 py-4">{f.last_survey_date || '미점검'}</td>
                  <td className="px-6 py-4 text-amber-600 font-medium">
                    {f.last_survey_date ? `${diffMonths}개월 경과` : '점검 기록 없음'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 hover:bg-zinc-50 text-xs">
                      <Repeat size={14} /> 재조사 일정 등록
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
