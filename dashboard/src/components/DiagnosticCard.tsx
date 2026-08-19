import React from 'react';
import { DiagnosticResult } from '../types';
import { CheckCircle2, AlertCircle, Wrench, ShieldAlert, Cpu } from 'lucide-react';

interface DiagnosticCardProps {
  diagnostic?: DiagnosticResult;
  compact?: boolean;
}

export const DiagnosticCard: React.FC<DiagnosticCardProps> = ({ diagnostic, compact = false }) => {
  if (!diagnostic) {
    return (
      <div className="text-xs font-mono text-slate-500 italic">
        No diagnostic evidence generated.
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/90 p-4 font-mono ${compact ? 'text-xs' : ''}`}>
      {/* Header with Rule Badge */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase text-slate-300">
            Rule-Based Root Cause Diagnosis
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
          {diagnostic.rule_id}
        </span>
      </div>

      {/* Probable Cause */}
      <div className="mb-3">
        <span className="text-slate-400 text-xs block mb-0.5">Probable Cause:</span>
        <div className="text-sm font-semibold text-white bg-slate-950 px-3 py-1.5 rounded border border-slate-800/80">
          {diagnostic.probable_cause}
        </div>
      </div>

      {/* Evidence Checklist */}
      {diagnostic.evidence && diagnostic.evidence.length > 0 && (
        <div className="mb-3">
          <span className="text-slate-400 text-xs block mb-1.5">Evidence Checklist:</span>
          <div className="space-y-1">
            {diagnostic.evidence.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Action */}
      {diagnostic.recommendation && (
        <div className="mt-3 pt-2 border-t border-slate-800/60">
          <div className="flex items-start space-x-2 text-xs text-cyan-300 bg-cyan-950/40 p-2.5 rounded border border-cyan-900/40">
            <Wrench className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block mb-0.5">Recommended Remediation:</span>
              <span className="text-slate-300">{diagnostic.recommendation}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
