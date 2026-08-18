'use client';

import { useState } from 'react';
import { MockData } from '@/app/page';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface BarChartCompProps {
  facilities: MockData['facilities'];
  categoryScores: MockData['categoryScores'];
  selectedCategory: string;
  onSelectFacility: (id: string) => void;
}

export default function BarChartComp({ facilities, categoryScores, selectedCategory, onSelectFacility }: BarChartCompProps) {
  if (!facilities || facilities.length === 0) return null;

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
  }).filter(d => d.hasData).sort((a, b) => b.score - a.score); // Sort descending

  // Identify bottom N (e.g., bottom 3)
  const bottomThreshold = chartData.length > 3 ? chartData[chartData.length - 3].score : 100;

  return (
    <div className="w-full space-y-4">
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
        <h4 className="text-sm font-semibold text-zinc-700 mb-4 text-center">
          {selectedCategory === "ALL" ? "종합 점수 전체 시설 순위 (가로 스크롤)" : `${selectedCategory.split('_')[1]} 전체 시설 순위 (가로 스크롤)`}
        </h4>
        <div className="w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
          <div style={{ minWidth: '100%', width: Math.max(100, chartData.length * 35) }} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
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
              <Bar 
                dataKey="score" 
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
                    fill={entry.score <= bottomThreshold || entry.score < 50 ? '#f87171' : '#60a5fa'} 
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
