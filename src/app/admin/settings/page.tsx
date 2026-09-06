'use client';

import { Shield, Database, Clock, Search } from 'lucide-react';
import auditData from '@/data/audit_mock.json';
import { useState } from 'react';

export default function SettingsDashboard() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditData.filter(log => 
    log.target_data.includes(searchTerm) || log.operator.includes(searchTerm) || log.action_type.includes(searchTerm)
  );

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">시스템 관리</h1>
        <p className="text-zinc-500 mt-1">사용자 권한(Role) 관리, 변경 이력(Audit Log) 확인 및 데이터 파이프라인 연동 상태를 확인합니다.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 권한 관리 요약 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-zinc-900">
            <Shield size={20} className="text-blue-500" />
            <h2 className="font-bold">세분화된 역할(Role) 관리</h2>
          </div>
          <ul className="space-y-3 text-sm text-zinc-600">
            <li className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <span>최고 관리자 (Super Admin)</span>
              <span className="font-medium text-zinc-900">2명</span>
            </li>
            <li className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <span>Tier 1~5 담당자 (운영진)</span>
              <span className="font-medium text-zinc-900">14명</span>
            </li>
            <li className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <span>지자체 담당자 (Official)</span>
              <span className="font-medium text-zinc-900">45명</span>
            </li>
            <li className="flex justify-between items-center">
              <span>일반 사용자 (Viewer)</span>
              <span className="font-medium text-zinc-900">∞</span>
            </li>
          </ul>
          <button className="w-full mt-4 py-2 border border-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50">
            권한 그룹 설정 열기
          </button>
        </div>

        {/* 데이터 소스 연동 상태 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-zinc-900">
            <Database size={20} className="text-emerald-500" />
            <h2 className="font-bold">데이터 파이프라인 연동 상태</h2>
          </div>
          
          <div className="flex-1 grid grid-cols-3 gap-4 mb-4">
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex flex-col justify-center items-center text-center">
              <div className="text-xs font-bold text-zinc-500 mb-1">AppSheet (워크숍 폼)</div>
              <div className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 정상 연동
              </div>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex flex-col justify-center items-center text-center">
              <div className="text-xs font-bold text-zinc-500 mb-1">마스터 DB (규격/법령)</div>
              <div className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 정상 연동
              </div>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex flex-col justify-center items-center text-center">
              <div className="text-xs font-bold text-zinc-500 mb-1">카카오맵 API</div>
              <div className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 정상 연동
              </div>
            </div>
          </div>

          <div className="mt-auto text-xs text-zinc-500 flex justify-between items-center border-t border-zinc-100 pt-4">
            <span className="flex items-center gap-1"><Clock size={14} /> 마지막 동기화: 오늘 오전 09:15</span>
            <button className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded font-medium transition-colors">
              수동 동기화
            </button>
          </div>
        </div>
      </div>

      {/* 변경 이력 로그 (Audit Log) */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
          <h2 className="font-bold text-zinc-800">변경 이력 감사 로그 (Audit Log)</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text" 
              placeholder="로그 내용 검색..." 
              className="w-full pl-9 pr-3 py-1.5 border border-zinc-300 rounded-md text-sm focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 bg-zinc-100 uppercase border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4">일시</th>
              <th className="px-6 py-4">작업자</th>
              <th className="px-6 py-4">유형</th>
              <th className="px-6 py-4">대상 데이터</th>
              <th className="px-6 py-4">상세 내용</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-zinc-50">
                <td className="px-6 py-3 font-mono text-xs text-zinc-500">{new Date(log.timestamp).toLocaleString('ko-KR')}</td>
                <td className="px-6 py-3 font-medium text-zinc-900">{log.operator}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    log.action_type.includes('초기화') || log.action_type === '삭제' ? 'bg-red-100 text-red-700' : 
                    log.action_type === '수정' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {log.action_type}
                  </span>
                </td>
                <td className="px-6 py-3 text-zinc-800">{log.target_data}</td>
                <td className="px-6 py-3 text-zinc-500">{log.details}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
