'use client';

import { useState } from 'react';
import { Search, FileText, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import mockDataRaw from '@/data/mock.json';
import tier1Mock from '@/data/tier1_mock.json';

export default function Tier1Dashboard() {
  const [searchTerm, setSearchTerm] = useState('');

  // Combine mock data to simulate a table of diagnosis requests
  const requests = tier1Mock.facilities_details.map(detail => {
    const base = mockDataRaw.facilities.find(f => f.id === detail.id);
    return {
      id: detail.id,
      doc_number: detail.doc_number,
      name: base?.name || detail.overview.name,
      address: detail.overview.address,
      request_date: detail.overview.survey_date,
      status: '완료', // '대기', '진행중', '완료'
      manager: '내부운영팀'
    };
  });

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Tier 1. 미니 진단</h1>
        <p className="text-zinc-500 mt-1">단일 시설 및 상권을 대상으로 한 긴급 정밀진단 요청 리스트와 보고서 생성 메뉴입니다.</p>
      </header>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="시설명 또는 문서번호 검색..." 
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors">
            신규 요청 등록
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 bg-zinc-100 uppercase border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 font-semibold">문서번호</th>
                <th className="px-6 py-4 font-semibold">시설명</th>
                <th className="px-6 py-4 font-semibold">소재지</th>
                <th className="px-6 py-4 font-semibold">의뢰일</th>
                <th className="px-6 py-4 font-semibold">담당자</th>
                <th className="px-6 py-4 font-semibold">상태</th>
                <th className="px-6 py-4 font-semibold text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-900">{req.doc_number}</td>
                  <td className="px-6 py-4">{req.name}</td>
                  <td className="px-6 py-4 text-zinc-500 truncate max-w-xs">{req.address}</td>
                  <td className="px-6 py-4">{req.request_date}</td>
                  <td className="px-6 py-4">{req.manager}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle size={12} />
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/tier1/report/${req.id}`}>
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 hover:bg-zinc-50 transition-colors">
                        <FileText size={14} />
                        보고서 생성
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    진단 요청 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
