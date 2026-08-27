'use client';

import { useState } from 'react';
import { MockData } from '@/app/page';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';

interface BarChartCompProps {
  facilities: MockData['facilities'];
  categoryScores: MockData['categoryScores'];
  selectedCategory: string;
  onSelectFacility: (id: string) => void;
}

export default function BarChartComp({ facilities, categoryScores, selectedCategory, onSelectFacility }: BarChartCompProps) {
  if (!facilities || facilities.length === 0) return null;

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Prepare data for the selected category
  const chartData = facilities.map(f => {
    let finalScore = 0;
    let hasData = false;
    
    if (selectedCategory === "ALL") {
      const fScores = categoryScores.filter(s => s.facility_id === f.id && s.score !== null);
      if (fScores.length > 0) {
        finalScore = fScores.reduce((acc, curr) => acc + (curr.score || 0), 0) / fScores.length;
        hasData = true;
      }
    } else {
      const scoreObj = categoryScores.find(s => s.facility_id === f.id && s.category === selectedCategory);
      if (scoreObj && scoreObj.score !== null) {
        finalScore = scoreObj.score;
        hasData = true;
      }
    }
    
    return {
      id: f.id,
      name: f.name,
      score: Math.round(finalScore),
      hasData
    };
  })
  .filter(d => d.hasData)
  .filter(d => searchTerm ? d.name.toLowerCase().includes(searchTerm.toLowerCase()) : true)
  .sort((a, b) => sortOrder === 'desc' ? b.score - a.score : a.score - b.score);

  const zoneAvg = chartData.length > 0 ? chartData.reduce((sum, item) => sum + item.score, 0) / chartData.length : 0;
  
  let globalAvg = 0;
  if (selectedCategory === "ALL") {
    // 5 카테고리별로 먼저 각 시설의 평균을 구한 뒤 전체 평균
    const facilityMap = new Map<string, { total: number, count: number }>();
    categoryScores.filter(s => s.score !== null).forEach(s => {
      const f = facilityMap.get(s.facility_id) || { total: 0, count: 0 };
      f.total += s.score!;
      f.count += 1;
      facilityMap.set(s.facility_id, f);
    });
    let sum = 0;
    facilityMap.forEach(f => sum += (f.total / f.count));
    globalAvg = facilityMap.size > 0 ? sum / facilityMap.size : 0;
  } else {
    const catScores = categoryScores.filter(s => s.category === selectedCategory && s.score !== null);
    globalAvg = catScores.length > 0 ? catScores.reduce((sum, s) => sum + s.score!, 0) / catScores.length : 0;
  }

  // Identify bottom N (e.g., bottom 3)
  const bottomThreshold = chartData.length > 3 ? chartData[chartData.length - 3].score : 100;
  const maxNameLength = chartData.length > 0 ? Math.max(...chartData.map(d => d.name.length)) : 0;
  const dynamicBottomMargin = Math.max(40, maxNameLength * 6);
  const chartHeight = 220 + dynamicBottomMargin;
  const rankingTitle = selectedCategory === "ALL" ? "종합 접근성 순위" : `${selectedCategory.split('_')[1]} 시설 순위`;

  return (
    <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm print:shadow-none print:border-none print:p-0">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-800">{rankingTitle}</h3>
          <p className="text-xs text-zinc-500 mt-1">평균 점수 기준 내림차순 정렬</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0 print:hidden">
          <input 
            type="text" 
            placeholder="시설명 검색..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-blue-400"
          />
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="px-2 py-1 bg-white border border-zinc-200 rounded-md hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            {sortOrder === 'desc' ? '내림차순 ↓' : '오름차순 ↑'}
          </button>
        </div>
      </div>
      <div className="w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
        <div style={{ minWidth: '100%', width: Math.max(100, chartData.length * 35), height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -20, bottom: dynamicBottomMargin }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#71717a' }} 
                dy={10} 
                angle={-45} 
                textAnchor="end"
              />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
              <Tooltip 
                cursor={{ fill: '#f4f4f5' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <ReferenceLine y={globalAvg} stroke="#9ca3af" strokeDasharray="3 3" label={{ position: 'top', value: `전체평균(${Math.round(globalAvg)}점)`, fill: '#9ca3af', fontSize: 10 }} />
              <ReferenceLine y={zoneAvg} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: `구역평균(${Math.round(zoneAvg)}점)`, fill: '#f59e0b', fontSize: 10 }} />
              <Bar 
                dataKey="score" 
                isAnimationActive={false}
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
                minPointSize={4}
                onClick={(data: any) => {
                  if (data && data.id) {
                    onSelectFacility(data.id);
                  } else if (data && data.payload && data.payload.id) {
                    onSelectFacility(data.payload.id);
                  }
                }}
                className="cursor-pointer"
              >
                <LabelList 
                  dataKey="score" 
                  position="top" 
                  fill="#71717a" 
                  fontSize={10} 
                  formatter={(val: any) => val === 0 ? '0' : val}
                />
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.score < 100 ? '#ef4444' : '#3b82f6'} 
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
  );
}
