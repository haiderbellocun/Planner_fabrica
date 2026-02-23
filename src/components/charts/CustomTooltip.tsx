import * as React from 'react';

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: string | number; dataKey?: string; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}

/**
 * Premium tooltip for Recharts: white bg, soft border, rounded-xl, clear typography.
 * Use as content for <Tooltip content={<CustomTooltip />} />.
 */
export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-black/5 shadow-lg rounded-xl p-3 min-w-[140px]">
      {label != null && (
        <p className="text-sm font-medium text-[#0F172A] mb-2">{String(label)}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <span className="text-[#64748B]">{item.name ?? item.dataKey ?? ''}</span>
            <span className="font-medium text-[#0F172A]">
              {typeof item.value === 'number' ? item.value.toLocaleString() : String(item.value ?? '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
