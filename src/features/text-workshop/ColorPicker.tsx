import React, { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const COLOR_PALETTE = [
  // 基础与灰阶
  '#FFFFFF', '#F3F4F6', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563', '#374151', '#1F2937', '#111827', '#000000',
  // 电影莫兰迪
  '#D9B8B5', '#C4A882', '#9BB4C4', '#BBCDBA', '#ABA3B2', '#D1C4E9', '#B2DFDB', '#FFE082', '#FFAB91', '#F48FB1', '#CE93D8',
  // 热烈高亮 (标题极佳)
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  // 高级剧场深色
  '#7F1D1D', '#9A3412', '#B45309', '#A16207', '#4D7C0F', '#15803D', '#047857', '#0F766E', '#1D4ED8', '#4338CA', '#86198F'
];

interface ColorPickerProps {
  currentVal: string;
  defVal: string;
  onChange: (color: string) => void;
  style?: React.CSSProperties;
}

const ColorPicker = memo(({ currentVal, defVal, onChange, style }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current && ref.current.contains(target)) return;
      if (document.getElementById('color-picker-popover')?.contains(target)) return;
      setIsOpen(false);
    };
    window.addEventListener('mousedown', onClick, true);
    return () => window.removeEventListener('mousedown', onClick, true);
  }, [isOpen]);

  const popoverContent = isOpen && ref.current ? (
    <div
      id="color-picker-popover"
      style={{
        position: 'absolute',
        top: ref.current.getBoundingClientRect().bottom + 8,
        left: ref.current.getBoundingClientRect().left,
        width: 250, 
        background: 'rgba(22, 22, 26, 0.98)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
        zIndex: 999999,
        display: 'flex', flexDirection: 'column', gap: 10
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 1 }}>高定色彩库</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: '6px 4px' }}>
        {COLOR_PALETTE.map(c => (
          <div
            key={c}
            onClick={() => { onChange(c); setIsOpen(false); }}
            title={c}
            className="ios-hover-scale"
            style={{
              width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer', flexShrink: 0,
              border: currentVal === c ? '2px solid #8B5CF6' : '1px solid rgba(255,255,255,0.1)',
              boxShadow: currentVal === c ? '0 0 8px rgba(139,92,246,0.6)' : 'none',
              transform: currentVal === c ? 'scale(1.2)' : 'scale(1)',
              transition: 'all 0.1s'
            }}
          />
        ))}
      </div>

      <div style={{ width: '100%', height: 1, background: 'rgba(255, 255, 255, 0.05)' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>当前 HEX</span>
        <div style={{ color: currentVal || defVal, fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
          {currentVal || defVal}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={ref}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="ios-hover-scale"
        style={{
          width: 20, height: 20, borderRadius: '50%', ...style,
          background: currentVal || defVal,
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
          cursor: 'pointer', flexShrink: 0
        }}
      />
      {isOpen && createPortal(popoverContent, document.body)}
    </>
  );
});

export default ColorPicker;
