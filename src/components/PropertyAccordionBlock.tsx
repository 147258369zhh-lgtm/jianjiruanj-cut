import React from 'react';

export interface PropertyAccordionBlockProps {
  id: string;
  title: string;
  icon?: string;
  order: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onReset?: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export const PropertyAccordionBlock: React.FC<PropertyAccordionBlockProps> = ({
  id, title, icon, order, isCollapsed, onToggle, onReset,
  onDragStart, onDragOver, onDragEnd, onDrop, children
}) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`property-accordion-block ${id}-block`}
      style={{
        order,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        marginBottom: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
        transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s',
      }}
    >
      {/* Header */}
      <div
        className="accordion-header"
        onClick={onToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          cursor: 'pointer',
          background: isCollapsed ? 'transparent' : 'rgba(255,255,255,0.03)',
          borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.03)',
          transition: 'background 0.2s',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ cursor: 'grab' }} className="drag-handle" title="按住拖拽排序" onClick={e => e.stopPropagation()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="9" x2="20" y2="9"></line>
              <line x1="4" y1="15" x2="20" y2="15"></line>
            </svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon && <span>{icon}</span>}
            {title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onReset && (
            <div
              className="reset-btn ios-hover-scale"
              title="重置模块参数"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: 6,
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12, transition: 'all 0.2s'
              }}
            >
              ↺
            </div>
          )}
          <span style={{
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: 0.5,
            fontSize: 10
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className="accordion-content"
        style={{
          height: isCollapsed ? 0 : 'auto',
          overflow: isCollapsed ? 'hidden' : 'visible',
          opacity: isCollapsed ? 0 : 1,
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: isCollapsed ? 0 : '14px',
          paddingBottom: isCollapsed ? 0 : '16px',
        }}
      >
        {children}
      </div>
    </div>
  );
};
