import React from 'react';
import { HealthResponse } from '../types';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface HealthGaugeProps {
  health: HealthResponse | null;
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({ health }) => {
  const score = health?.score ?? 100;
  const status = health?.status ?? 'HEALTHY';

  // SVG Gauge calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  // Use a 270-degree arc
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (arcLength * (score / 100));

  const getStatusColor = () => {
    if (score >= 70) return { stroke: '#10b981', text: 'text-emerald-400', badge: 'bg-emerald-950/80 text-emerald-400 border-emerald-800' };
    if (score >= 40) return { stroke: '#f59e0b', text: 'text-amber-400', badge: 'bg-amber-950/80 text-amber-400 border-amber-800' };
    return { stroke: '#ef4444', text: 'text-rose-400', badge: 'bg-rose-950/80 text-rose-400 border-rose-800' };
  };

  const colors = getStatusColor();

  return (
    <div className="cyber-card p-6 flex flex-col items-center text-center relative overflow-hidden">
      {/* Background ambient glow */}
      <div 
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: colors.stroke }}
      />

      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
          SYSTEM HEALTH SCORE
        </span>
        <span className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${colors.badge}`}>
          {status}
        </span>
      </div>

      {/* SVG Circular Dial */}
      <div className="relative w-44 h-44 flex items-center justify-center my-2">
        <svg className="w-full h-full transform -rotate-135" viewBox="0 0 160 160">
          {/* Background track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#1e293b"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active progress arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={colors.stroke}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Score Display */}
        <div className="absolute flex flex-col items-center">
          <span className={`text-4xl font-extrabold font-mono tracking-tight ${colors.text}`}>
            {score}
          </span>
          <span className="text-xs font-mono text-slate-400">/ 100</span>
        </div>
      </div>

      <p className="text-xs text-slate-300 font-mono text-center max-w-sm mt-1">
        {health?.summary || 'System running optimally.'}
      </p>

      {/* Active Penalties List if any */}
      {health?.penalties && health.penalties.length > 0 && (
        <div className="w-full mt-4 pt-3 border-t border-slate-800 text-left">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
            Health Deductions ({health.penalties.length})
          </span>
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {health.penalties.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-mono bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
                <span className="text-slate-300 truncate mr-2">{p.reason}</span>
                <span className="text-rose-400 font-bold shrink-0">-{p.points_deducted} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
