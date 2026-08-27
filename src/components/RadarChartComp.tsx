import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarData {
  subject: string;
  A: number;
  fullMark: number;
  id?: string;
}

export default function RadarChartComp({ data, onCategoryClick }: { data: RadarData[], onCategoryClick: (id: string) => void }) {
  if (!data || data.length === 0 || data.every(d => d.A === 0)) {
    return <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">데이터가 부족합니다</div>;
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e4e4e7" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#52525b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} 
            onClick={(e: any) => {
              if (e && e.value) {
                const targetCat = data.find(d => d.subject === e.value)?.id;
                if (targetCat) onCategoryClick(targetCat);
              }
            }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: '#f4f4f5' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-zinc-200 shadow-md rounded-xl">
                    <p className="font-bold text-zinc-800 text-sm mb-1">{data.subject}</p>
                    <p className="text-blue-600 font-semibold text-sm">접근성 점수: {data.A}점</p>
                    {data.A === 0 && <p className="text-xs text-zinc-400 mt-1">평가 데이터 없음</p>}
                  </div>
                );
              }
              return null;
            }}
          />
          <Radar 
            name="접근성 평균" 
            dataKey="visualA" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fill="#3b82f6" 
            fillOpacity={0.5} 
            dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
