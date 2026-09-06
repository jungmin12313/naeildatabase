'use client';

import { BarChart2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function Tier4Dashboard() {
  return (
    <div className="p-8 h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Tier 4. 통합 전수조사</h1>
        <p className="text-zinc-500 mt-1">지자체 및 구청 단위의 GIS 전수조사 모니터링, 예산 우선순위 컨설팅을 위한 다구역 비교 기능입니다.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 flex flex-col items-start shadow-sm">
          <div className="p-3 bg-blue-50 rounded-xl mb-4 text-blue-600">
            <BarChart2 size={24} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">다구역 비교 대시보드</h2>
          <p className="text-sm text-zinc-500 mb-6">최대 4개 구역을 선택하여 레이더 차트, 바 차트로 접근성 격차를 분석하고 GAP 테이블을 확인합니다.</p>
          <Link href="/compare" className="mt-auto">
            <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
              비교 대시보드 열기 <ExternalLink size={16} />
            </button>
          </Link>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-8 flex flex-col items-start shadow-sm">
          <div className="p-3 bg-emerald-50 rounded-xl mb-4 text-emerald-600">
            <BarChart2 size={24} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">단일 구역 상세 대시보드</h2>
          <p className="text-sm text-zinc-500 mb-6">특정 구역 내 시설들의 측정 커버리지 랭킹과 우선 개선 시설 목록, AI 종합 평가를 확인합니다.</p>
          <Link href="/dashboard" className="mt-auto">
            <button className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-zinc-700 bg-white rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
              상세 대시보드 열기 <ExternalLink size={16} />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
