'use client';

import { ArrowUpRight, ClipboardCheck, Users, Map, BarChart2, Repeat } from 'lucide-react';
import Link from 'next/link';

export default function AdminHome() {
  const kpiCards = [
    { tier: 'Tier 1', title: '미니 진단', value: '12건', desc: '이번 달 신규 요청', icon: ClipboardCheck, href: '/admin/tier1', color: 'text-blue-600', bg: 'bg-blue-50' },
    { tier: 'Tier 2', title: '워크숍', value: '3회', desc: '예정된 일정', icon: Users, href: '/admin/tier2', color: 'text-purple-600', bg: 'bg-purple-50' },
    { tier: 'Tier 3', title: '표준 지도', value: '45구역', desc: '발행 완료', icon: Map, href: '/admin/tier3', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { tier: 'Tier 4', title: '통합 전수조사', value: '2지자체', desc: '현재 진행 중', icon: BarChart2, href: '/admin/tier4', color: 'text-amber-600', bg: 'bg-amber-50' },
    { tier: 'Tier 5', title: '구독 모니터링', value: '8구역', desc: '재조사 필요', icon: Repeat, href: '/admin/tier5', color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">운영 현황 요약</h1>
        <p className="text-zinc-500 mt-1">모두의내일 Tier 1~5 패키지 상품의 핵심 KPI를 한눈에 확인하세요.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link key={idx} href={kpi.href}>
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${kpi.bg}`}>
                    <Icon size={24} className={kpi.color} />
                  </div>
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">{kpi.tier}</span>
                </div>
                
                <h3 className="text-zinc-500 font-medium text-sm mb-1">{kpi.title}</h3>
                <div className="text-3xl font-bold text-zinc-900 mb-2">{kpi.value}</div>
                <div className="mt-auto flex items-center text-xs text-zinc-500">
                  <ArrowUpRight size={14} className="mr-1" />
                  {kpi.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">빠른 실행</h2>
        <div className="flex gap-4">
          <Link href="/admin/tier1">
            <button className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors">
              새 진단보고서 생성하기
            </button>
          </Link>
          <Link href="/admin/tier4">
            <button className="px-5 py-2.5 bg-white border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors">
              다구역 비교 대시보드 열기
            </button>
          </Link>
        </div>
      </div>

      <div className="mt-8 bg-red-50/50 rounded-2xl border border-red-100 p-8 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900 mb-1">데이터 관리 (Data Management)</h2>
        <p className="text-sm text-zinc-500 mb-6">시스템의 핵심 데이터를 관리하고 초기화하는 공간입니다.</p>
        
        <div className="flex gap-4 items-center">
          <label className="cursor-pointer bg-zinc-800 text-white text-sm font-bold px-6 py-3 rounded-lg shadow-sm hover:bg-zinc-900 transition-colors text-center inline-block">
            📥 엑셀 DB 통합 자동업로드
            <input type="file" accept=".xlsx" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                alert('로컬에 설치된 DB로 업로드를 시작합니다. (터미널 로그를 확인해주세요)');
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload failed');
                const result = await res.json();
                alert(`업로드 성공! 총 ${result.zonesCount || 1}개의 구역과 1개의 전체구역이 생성되었습니다. 새로고침을 해주세요.`);
              } catch (err) {
                alert('업로드 중 오류가 발생했습니다.');
                console.error(err);
              }
            }} />
          </label>
          
          <button
            onClick={async () => {
              if(confirm('정말 모든 구역/시설 데이터를 삭제하시겠습니까?')) {
                try {
                  await fetch('/api/upload', { method: 'DELETE' });
                  alert('데이터 초기화가 완료되었습니다. 화면을 새로고침합니다.');
                  window.location.reload();
                } catch (err) {
                  alert('초기화 중 오류가 발생했습니다.');
                }
              }
            }}
            className="bg-white text-red-600 text-sm font-bold px-6 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            🗑️ 전체 데이터 완전 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
