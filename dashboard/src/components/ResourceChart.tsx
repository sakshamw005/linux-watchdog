import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { SystemMetrics } from '../types';

interface ResourceChartProps {
  data: SystemMetrics[];
}

export const ResourceChart: React.FC<ResourceChartProps> = ({ data }) => {
  const chartData = data.map((d) => {
    let timeLabel = d.timestamp;
    try {
      const dt = new Date(d.timestamp);
      timeLabel = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      timeLabel = d.timestamp.slice(11, 19);
    }
    return {
      time: timeLabel,
      CPU: d.cpu_percent,
      RAM: d.memory_percent,
      Disk: d.disk_percent,
      Load: d.load_1m,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl text-xs font-mono">
          <p className="text-slate-400 mb-1">{label}</p>
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between space-x-3 my-0.5">
              <span style={{ color: item.color }} className="font-semibold">
                {item.name}:
              </span>
              <span className="text-white font-bold">{item.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="cyber-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider block">
            REAL-TIME SYSTEM RESOURCE TELEMETRY
          </span>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            CPU & Memory utilization historical trend (/proc/stat & /proc/meminfo)
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span className="text-slate-300">CPU %</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            <span className="text-slate-300">RAM %</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
            Awaiting telemetry samples from Linux agent...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                unit="%"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="CPU"
                stroke="#38bdf8"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#cpuGradient)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="RAM"
                stroke="#a855f7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#ramGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
