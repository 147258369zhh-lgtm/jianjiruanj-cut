import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ─── 专业字体选择器 ────────────────────────────────────────────────────────
interface FontOptGroup {
  label: string;
  options: { label: string; value: string }[];
}

interface ProFontSelectProps {
  value: string;
  optGroups: FontOptGroup[];
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}

const ProFontSelect = ({ value, optGroups, onChange, style }: ProFontSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && 
          dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick, true);
    return () => window.removeEventListener('mousedown', onClick, true);
  }, [isOpen]);

  const flatOptions = optGroups.flatMap(g => g.options);
  const selectedOpt = flatOptions.find(o => o.value === value) || { label: '默认字体 (Default)', value };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', height: 36, boxSizing: 'border-box', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.05)', color: '#fff',
          border: isOpen ? '1px solid rgba(139, 92, 246, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8, padding: '0 12px', fontSize: 13, cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 2px rgba(139, 92, 246, 0.2)' : 'none',
          fontFamily: selectedOpt.value
        }}
        onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; } }}
        onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; } }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedOpt.label}</span>
        <span style={{ fontSize: 9, opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0 }}>▼</span>
      </div>
      {isOpen && createPortal(
        <div ref={dropdownRef} style={{
          position: 'absolute',
          top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 0,
          left: ref.current ? ref.current.getBoundingClientRect().left : 0,
          width: ref.current ? ref.current.getBoundingClientRect().width : 'auto',
          background: 'rgba(25, 25, 30, 0.98)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12, padding: '8px 6px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
          zIndex: 999999, maxHeight: 340, overflowY: 'auto' as const, scrollbarWidth: 'none' as const
        }}>
          {optGroups.map((group, gIdx) => (
            <div key={group.label} style={{ marginBottom: gIdx === optGroups.length - 1 ? 0 : 12 }}>
              <div style={{ padding: '4px 12px 6px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>{group.label}</div>
              {group.options.map(opt => (
                <div
                  key={opt.value}
                  style={{
                    padding: '8px 12px', fontSize: 14, fontFamily: opt.value,
                    color: opt.value === value ? '#C4B5FD' : 'rgba(255,255,255,0.85)',
                    background: opt.value === value ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    borderRadius: 8, cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { if (opt.value !== value) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={e => { if (opt.value !== value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProFontSelect;
