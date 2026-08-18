'use client';

import { useMemo } from 'react';
import { MockData } from '@/app/page';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import { evaluateMeasurement } from '@/constants/standards';

interface CategoryDetailChartsProps {
  facilities: MockData['facilities'];
  categoryScores: MockData['categoryScores'];
  measurements: MockData['measurements'];
  selectedCategory: string;
  onSelectFacility: (id: string) => void;
}

export default function CategoryDetailCharts({ facilities, categoryScores, measurements, selectedCategory, onSelectFacility }: CategoryDetailChartsProps) {
  
  // 1. Prepare data for Stacked Bar Chart (Pass/Fail rate per detailed metric)
  const metricPassRates = useMemo(() => {
    if (!facilities || facilities.length === 0) return [];
    const facilityIds = new Set(facilities.map(f => f.id));
    
    // Filter measurements for this category and these facilities
    const catMeasurements = measurements.filter(m => m.category === selectedCategory && facilityIds.has(m.facility_id));
    
    // Group by field_name
    const fieldMap: Record<string, { pass: number, fail: number, total: number }> = {};
    
    catMeasurements.forEach(m => {
      const { isPass } = evaluateMeasurement(m.field_name, m.value);
      if (isPass !== null) {
        if (!fieldMap[m.field_name]) {
          fieldMap[m.field_name] = { pass: 0, fail: 0, total: 0 };
        }
        fieldMap[m.field_name].total++;
        if (isPass) {
          fieldMap[m.field_name].pass++;
        } else {
          fieldMap[m.field_name].fail++;
        }
      }
    });
    
    // Convert to array for Recharts
    return Object.keys(fieldMap).map(field => {
      const { pass, fail, total } = fieldMap[field];
      return {
        name: field,
        pass,
        fail,
        total,
        passRate: Math.round((pass / total) * 100),
        failRate: Math.round((fail / total) * 100)
      };
    });
  }, [facilities, measurements, selectedCategory]);

  // 2. Prepare data for Facility Ranking Bar Chart
  const rankingData = useMemo(() => {
    const allData = facilities.map(f => {
      const scoreObj = categoryScores.find(s => s.facility_id === f.id && s.category === selectedCategory);
      return {
        id: f.id,
        name: f.name,
        score: scoreObj && scoreObj.score !== null ? Math.round(scoreObj.score) : 0,
        hasData: scoreObj && scoreObj.score !== null
      };
    }).filter(d => d.hasData).sort((a, b) => b.score - a.score);
    
    return allData;
  }, [facilities, categoryScores, selectedCategory]);

  const bottomThreshold = rankingData.length > 3 ? rankingData[rankingData.length - 3].score : 100;
  const catName = selectedCategory.split('_')[1];

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Pass/Fail Stacked Bar Chart for Detailed Metrics */}
      {metricPassRates.length > 0 && (
        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 shadow-sm print:bg-white print:border-zinc-300 page-break-inside-avoid">
          <h4 className="text-sm font-bold text-zinc-800 mb-1 text-center">
            {catName} 세부 실측항목 달성률
          </h4>
          <p className="text-[10px] text-zinc-500 text-center mb-4">법적 기준 합격(초록) 및 불합격(빨강) 비율</p>
          
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={metricPassRates}
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#52525b', fontWeight: 600 }} width={70} />
                <Tooltip
                  cursor={{ fill: '#f4f4f5' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-zinc-200 shadow-md rounded-xl text-sm">
                          <p className="font-bold text-zinc-800 mb-2 border-b pb-1">{data.name} 측정 결과</p>
                          <p className="text-green-600 font-semibold text-xs flex justify-between w-32">
                            <span>적합(Pass)</span> <span>{data.passRate}% ({data.pass}곳)</span>
                          </p>
                          <p className="text-red-500 font-semibold text-xs flex justify-between w-32 mt-1">
                            <span>부적합(Fail)</span> <span>{data.failRate}% ({data.fail}곳)</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="passRate" name="적합 (합격)" stackId="a" fill="#34d399" radius={[4, 0, 0, 4]} />
                <Bar dataKey="failRate" name="부적합 (미달)" stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. Facility Ranking Bar Chart */}
      <div className="bg-white rounded-2xl p-4 border border-zinc-200 print:border-zinc-300 page-break-inside-avoid">
        <h4 className="text-sm font-semibold text-zinc-700 mb-4 text-center">
          {catName} 전체 시설 순위 (가로 스크롤)
        </h4>
        <div className="w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
          <div style={{ minWidth: '100%', width: Math.max(100, rankingData.length * 35) }} className="h-56">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={rankingData} 
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
                name="접근성 점수"
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
                {rankingData.map((entry, index) => (
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
