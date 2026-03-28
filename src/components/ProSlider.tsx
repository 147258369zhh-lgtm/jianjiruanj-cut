import { memo } from 'react';

// ─── 无极滑块 ────────────────────────────────────────────────────────
const ProSlider = memo(({
  min, max, step, value, onChange, isCentered = false, centerValue = 0, gradient, style, onMouseUp
}: {
  min: number; max: number; step: number; value: number; onChange: (val: number) => void;
  isCentered?: boolean; centerValue?: number; gradient?: string; style?: React.CSSProperties; onMouseUp?: () => void;
}) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  let fillStyle = {};
  if (!gradient) {
    if (isCentered) {
      const zeroPercentage = Math.max(0, Math.min(100, ((centerValue - min) / (max - min)) * 100));
      if (value >= centerValue) {
        fillStyle = { left: `${zeroPercentage}%`, width: `${percentage - zeroPercentage}%` };
      } else {
        fillStyle = { left: `${percentage}%`, width: `${zeroPercentage - percentage}%` };
      }
    } else {
      fillStyle = { left: 0, width: `${percentage}%` };
    }
  } else {
    fillStyle = { display: 'none' };
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 20, display: 'flex', alignItems: 'center', touchAction: 'none', ...style }}>
      <div style={{ position: 'absolute', width: '100%', height: 4, background: gradient || 'rgba(255,255,255,0.15)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', height: 4, background: 'rgba(255,255,255,0.85)', borderRadius: 2, ...fillStyle, pointerEvents: 'none' }} />
      {isCentered && !gradient && <div style={{ position: 'absolute', height: 8, width: 2, background: 'rgba(255,255,255,0.6)', left: '50%', transform: 'translateX(-50%)', borderRadius: 1 }} />}
      {isCentered && gradient && <div style={{ position: 'absolute', height: 10, width: 2, background: 'rgba(255,255,255,0.9)', left: '50%', transform: 'translateX(-50%)', borderRadius: 1, boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />}
      <input type="range" min={min} max={max} step={step} value={value} 
        onChange={e => onChange(Number(e.target.value))} 
        onMouseUp={onMouseUp}
        onTouchEnd={onMouseUp}
        className="pro-slider-input" 
      />
    </div>
  );
});

export default ProSlider;
