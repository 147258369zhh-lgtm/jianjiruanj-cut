import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ─── 子组件: 沉浸式玻璃态自定义下拉框 (解决原生 select 无法美化弹窗的问题) ───
export const IosSelect = ({ value, options, onChange, style, favorites, onToggleFavorite }: { value: string; options: {value: string, label: string}[]; onChange: (v: string) => void; style?: React.CSSProperties; favorites?: Set<string>; onToggleFavorite?: (v: string) => void; }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', onClick, true); // mousedown captures better than click
    return () => window.removeEventListener('mousedown', onClick, true);
  }, [isOpen]);

  const selectedOpt = options.find(o => o.value === value) || { label: value };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(20, 20, 25, 0.8)', color: '#fff', border: isOpen ? '1px solid var(--ios-indigo)' : '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 12, padding: '0 12px', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', boxShadow: isOpen ? '0 0 0 2px var(--ios-indigo-glow)' : 'none' }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(30,30,35,0.9)'; e.currentTarget.style.borderColor = isOpen ? 'var(--ios-indigo)' : 'var(--ios-indigo)'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(20,20,25,0.8)'; e.currentTarget.style.borderColor = isOpen ? 'var(--ios-indigo)' : 'rgba(255,255,255,0.1)'; }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedOpt?.label}</span>
        <span style={{ fontSize: 9, opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0 }}>▼</span>
      </div>
      {isOpen && createPortal(
        <div style={{
          position: 'absolute',
          top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 0,
          left: ref.current ? ref.current.getBoundingClientRect().left : 0,
          width: ref.current ? ref.current.getBoundingClientRect().width : 'auto',
          boxSizing: 'border-box',
          background: 'rgba(30, 30, 38, 0.95)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 12,
          padding: 6,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
          zIndex: 999999,
          maxHeight: 280,
          overflowY: 'auto'
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                color: opt.value === value ? '#fff' : 'rgba(255,255,255,0.7)',
                background: opt.value === value ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (opt.value !== value) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
              onMouseLeave={e => { if (opt.value !== value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              <span style={{flex: 1}}>{opt.label}</span>
              {favorites && onToggleFavorite && opt.value !== 'none' && opt.value !== 'random' && (
                <span 
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(opt.value); }}
                  style={{
                    color: favorites.has(opt.value) ? '#FFD700' : 'rgba(255,255,255,0.2)',
                    fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
                    transition: 'all 0.2s', paddingLeft: 8
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  title={favorites.has(opt.value) ? '取消收藏' : '加入收藏'}
                >
                  {favorites.has(opt.value) ? '★' : '☆'}
                </span>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
