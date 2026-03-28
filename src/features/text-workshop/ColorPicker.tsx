import { memo } from 'react';

// ─── 莫兰迪影视级色盘 ────────────────────────────────────────────────────────
const COLOR_PALETTE = [
  '#FFFFFF', '#F5F5F5', '#1A1A1A', '#D9B8B5', '#C4A882', '#9BB4C4', '#BBCDBA', '#ABA3B2',
  '#FF6B6B', '#E85D75', '#FF9F43', '#FECA57', '#48DBFB', '#0ABDE3', '#6C5CE7', '#A29BFE',
  '#1DD1A1', '#10AC84', '#FF6348', '#2ED573', '#FFA502', '#3742FA'
];

interface ColorPickerProps {
  currentVal: string;
  defVal: string;
  onChange: (color: string) => void;
}

const ColorPicker = memo(({ currentVal, defVal, onChange }: ColorPickerProps) => {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '2px 0' }}>
      {COLOR_PALETTE.map(c => (
        <div
          key={c}
          onClick={() => onChange(c)}
          title={c}
          style={{
            width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer',
            border: currentVal === c ? '2px solid #6366F1' : '1px solid rgba(255,255,255,0.2)',
            boxShadow: currentVal === c ? '0 0 8px rgba(99,102,241,0.6)' : '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'all 0.15s',
            transform: currentVal === c ? 'scale(1.1)' : 'scale(1)'
          }}
        />
      ))}
      {/* 彩虹自由拾色器 */}
      <div
        style={{
          position: 'relative', width: 22, height: 22, borderRadius: '50%', overflow: 'hidden',
          border: '1.5px solid rgba(255,255,255,0.5)',
          background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
          cursor: 'pointer', marginLeft: 4
        }}
        title="自由取色"
      >
        <input
          type="color"
          value={currentVal || defVal}
          onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', top: -10, left: -10, width: 44, height: 44, cursor: 'pointer', opacity: 0 }}
        />
      </div>
    </div>
  );
});

export default ColorPicker;
