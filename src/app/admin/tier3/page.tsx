'use client';

import { Map, Link as LinkIcon, Settings2 } from 'lucide-react';
import mockDataRaw from '@/data/mock.json';

export default function Tier3Dashboard() {
  const zones = mockDataRaw.zones;

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Tier 3. 표준 지도</h1>
        <p className="text-zinc-500 mt-1">지자체/축제조직위 대상 온·오프라인 무장애지도 발행 상태 및 향후 라우팅 엔진 검수 메뉴입니다.</p>
      </header>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
          <h2 className="font-bold text-zinc-800">구역별 지도 발행 현황</h2>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 bg-zinc-100 uppercase border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4">구역명</th>
              <th className="px-6 py-4">레벨</th>
              <th className="px-6 py-4">지도 발행 상태</th>
              <th className="px-6 py-4">라우팅(우회경로) 현황</th>
              <th className="px-6 py-4 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {zones.map(z => (
              <tr key={z.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-bold text-zinc-900">{z.name}</td>
                <td className="px-6 py-4">{z.level}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">온라인 라이브</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-zinc-400 text-xs">향후 개발 예정 (v2.0)</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-1.5 border border-zinc-300 rounded text-zinc-600 hover:bg-zinc-100" title="퍼블릭 링크 복사">
                      <LinkIcon size={14} />
                    </button>
                    <button className="p-1.5 border border-zinc-300 rounded text-zinc-600 hover:bg-zinc-100" title="지도 설정">
                      <Settings2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
