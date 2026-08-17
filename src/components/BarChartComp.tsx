'use client';

import { useState } from 'react';
import { MockData } from '@/app/page';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
    const scoreObj = categoryScores.find(s => s.facility_id === f.id && s.category === selectedCategory);
    return {
      id: f.id,
      name: f.name,
      score: scoreObj && scoreObj.score !== null ? Math.round(scoreObj.score) : 0,
      hasData: scoreObj && scoreObj.score !== null
    };
  }).filter(d => d.hasData).sort((a, b) => b.score - a.score); // Sort descending

  // Identify bottom N (e.g., bottom 3)
  const bottomThreshold = chartData.length > 3 ? chartData[chartData.length - 3].score : 100;

  return (
    <div className="w-full space-y-4">
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
        <h4 className="text-sm font-semibold text-zinc-700 mb-4 text-center">
          {selectedCategory.split('_')[1]} 시설별 점수 (클릭 시 상세 이동)
        </h4>
        <div className="w-full h-64">
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
                onClick={(data: any) => {
                  if (data && data.id) {
                    onSelectFacility(data.id);
                  } else if (data && data.payload && data.payload.id) {
                    onSelectFacility(data.payload.id);
                  }
                }}
                className="cursor-pointer"
              >
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
  );
}
