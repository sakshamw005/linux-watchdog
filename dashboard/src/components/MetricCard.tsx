import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  percent?: number;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple';
  statusBadge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  percent,
  color = 'cyan',
  statusBadge,
}) => {
  const colorMap = {
    cyan: {
      border: 'border-cyan-500/20',
      iconBg: 'bg-cyan-500/10 text-cyan-400',
      bar: 'bg-gradient-to-r from-cyan-600 to-cyan-400',
      glow: 'shadow-cyan-500/10',
    },
    emerald: {
      border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      bar: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
      glow: 'shadow-emerald-500/10',
    },
    amber: {
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-500/10 text-amber-400',
      bar: 'bg-gradient-to-r from-amber-600 to-amber-400',
      glow: 'shadow-amber-500/10',
    },
    rose: {
      border: 'border-rose-500/20',
      iconBg: 'bg-rose-500/10 text-rose-400',
      bar: 'bg-gradient-to-r from-rose-600 to-rose-400',
      glow: 'shadow-rose-500/10',
    },
    purple: {
      border: 'border-purple-500/20',
      iconBg: 'bg-purple-500/10 text-purple-400',
      bar: 'bg-gradient-to-r from-purple-600 to-purple-400',
      glow: 'shadow-purple-500/10',
    },
  };

  const c = colorMap[color];

  return (
    <div className={`cyber-card p-5 hover:border-slate-700 transition-all ${c.glow}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${c.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-bold font-mono tracking-tight text-white">
            {value}
          </span>
          {unit && <span className="text-sm font-mono text-slate-400">{unit}</span>}
        </div>
        {statusBadge && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {statusBadge}
          </span>
        )}
      </div>

      {percent !== undefined && (
        <div className="mt-3">
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${c.bar} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>
      )}

      {subtitle && (
        <p className="mt-2 text-xs font-mono text-slate-400 truncate">{subtitle}</p>
      )}
    </div>
  );
};
