'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, CartesianGrid, ReferenceLine } from 'recharts';

interface CategorySpecificChartProps {
  category: string;
  data: any[]; // Expects the ranking array format
  globalAvg?: number;
}

export default function CategorySpecificChart({ category, data, globalAvg }: CategorySpecificChartProps) {
  const chartData = data.filter(d => d.hasData);
  if (!chartData || chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">데이터가 없습니다.</div>;
  }

  // S1 & S2: Bar Chart (Changed from Area Chart per request, ensuring all data is visible without truncation)
  if (category === 'S1_보행로' || category === 'S2_출입구') {
    const isS1 = category === 'S1_보행로';
    const zoneAvg = chartData.length > 0 ? chartData.reduce((sum, d) => sum + d.avgScore, 0) / chartData.length : 0;
    
    // Calculate dynamic bottom margin to prevent long name truncation
    const maxNameLength = chartData.length > 0 ? Math.max(...chartData.map(d => d.name.length)) : 0;
    const dynamicBottomMargin = Math.max(40, maxNameLength * 6);
    const chartHeight = 220 + dynamicBottomMargin;

    return (
      <div className="w-full bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm page-break-inside-avoid">
        <h4 className="text-sm font-bold text-zinc-800 mb-4 flex items-center">
          <span className={`w-2 h-2 rounded-full ${isS1 ? 'bg-blue-500' : 'bg-emerald-500'} mr-2`}></span>
          {isS1 ? '보행로 접근성 비교' : '출입구별 접근성 비교'} (Bar Chart)
        </h4>
        <div className="w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
          <div style={{ minWidth: '100%', width: Math.max(100, chartData.length * 35), height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: dynamicBottomMargin }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey="name" 
                  tick={{fontSize: 10, fill: '#71717a'}} 
                  interval={0} 
                  angle={-45} 
                  textAnchor="end"
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#71717a'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#f4f4f5'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                {globalAvg !== undefined && <ReferenceLine y={globalAvg} stroke="#9ca3af" strokeDasharray="3 3" label={{ position: 'top', value: `전체평균(${Math.round(globalAvg)}점)`, fill: '#9ca3af', fontSize: 10 }} />}
                <ReferenceLine y={zoneAvg} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: `구역평균(${Math.round(zoneAvg)}점)`, fill: '#f59e0b', fontSize: 10 }} />
                <Bar isAnimationActive={false} dataKey="avgScore" name="점수" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.avgScore < 100 ? '#ef4444' : (isS1 ? "#3b82f6" : "#10b981")} 
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

  // S3 & S5: Pie/Donut Chart (Distribution of accessibility levels)
  if (category === 'S3_화장실' || category === 'S5_주차장') {
    const dist = [
      { name: '우수 (90~100)', value: chartData.filter(d => d.avgScore >= 90).length, color: '#22c55e' },
      { name: '보통 (70~89)', value: chartData.filter(d => d.avgScore >= 70 && d.avgScore < 90).length, color: '#eab308' },
      { name: '미흡 (70 미만)', value: chartData.filter(d => d.avgScore < 70).length, color: '#ef4444' },
    ].filter(d => d.value > 0);

    const isDonut = category === 'S5_주차장';

    return (
      <div className="w-full h-64 bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col items-center page-break-inside-avoid">
        <h4 className="text-sm font-bold text-zinc-800 mb-2 w-full flex items-center">
          <span className={`w-2 h-2 rounded-full mr-2 ${category === 'S3_화장실' ? 'bg-amber-500' : 'bg-purple-500'}`}></span>
          {category === 'S3_화장실' ? '화장실 접근성 등급 분포 (Pie Chart)' : '주차장 접근성 등급 분포 (Donut Chart)'}
        </h4>
        {dist.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} 
                data={dist} 
                cx="50%" cy="50%" 
                innerRadius={isDonut ? 50 : 0} 
                outerRadius={80} 
                dataKey="value" 
                label={({name, value}) => `${name ? String(name).split(' ')[0] : ''} ${value}개`} 
                labelLine={false}
              >
                {dist.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex-1 flex items-center text-zinc-400 text-sm">표시할 등급 데이터가 없습니다.</div>
        )}
      </div>
    );
  }

  // S4: Line Chart (Trend/Scattering for elevators)
  if (category === 'S4_엘리베이터') {
    return (
      <div className="w-full h-64 bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm page-break-inside-avoid">
        <h4 className="text-sm font-bold text-zinc-800 mb-4 flex items-center">
          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
          엘리베이터 접근성 현황 (Line Chart)
        </h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#71717a'}} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#71717a'}} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Line isAnimationActive={false} type="monotone" dataKey="avgScore" name="점수" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
