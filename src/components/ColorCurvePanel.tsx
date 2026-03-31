import React, { useRef, useState } from 'react';

interface Point { x: number, y: number }

interface ColorCurvePanelProps {
  curveMaster?: Point[];
  curveRed?: Point[];
  curveGreen?: Point[];
  curveBlue?: Point[];
  onChange: (channel: 'master'|'red'|'green'|'blue', points: Point[]) => void;
  commitUndo: () => void;
}

const DEFAULT_POINTS: Point[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.75 },
  { x: 1, y: 1 }
];

export const ColorCurvePanel: React.FC<ColorCurvePanelProps> = ({
  curveMaster,
  curveRed,
  curveGreen,
  curveBlue,
  onChange,
  commitUndo
}) => {
  const [activeChannel, setActiveChannel] = useState<'master'|'red'|'green'|'blue'>('master');
  
  const getActivePoints = () => {
    switch(activeChannel) {
      case 'master': return curveMaster?.length ? curveMaster : DEFAULT_POINTS;
      case 'red': return curveRed?.length ? curveRed : DEFAULT_POINTS;
      case 'green': return curveGreen?.length ? curveGreen : DEFAULT_POINTS;
      case 'blue': return curveBlue?.length ? curveBlue : DEFAULT_POINTS;
      default: return DEFAULT_POINTS;
    }
  };

  const points = getActivePoints();
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const colors = { master: '#FFFFFF', red: '#EF4444', green: '#10B981', blue: '#3B82F6' };

  // --- 拖拽交互 ---
  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault(); // prevent text selection
    setDraggingIdx(idx);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = 1 - ((e.clientY - rect.top) / rect.height);
    
    // Y 极值限制
    y = Math.max(0, Math.min(1, y));
    
    // 首尾节点 X 不能变
    if (draggingIdx === 0) x = 0;
    else if (draggingIdx === points.length - 1) x = 1;
    else {
      // 内部点必须卡在左右兄弟的 X 区间内
      const minX = points[draggingIdx - 1].x + 0.01;
      const maxX = points[draggingIdx + 1].x - 0.01;
      if (minX <= maxX) {
         x = Math.max(minX, Math.min(maxX, x));
      } else {
         x = points[draggingIdx].x;
      }
    }
    
    const newPoints = [...points];
    newPoints[draggingIdx] = { x, y };
    onChange(activeChannel, newPoints);
  };

  const handlePointerUp = (_idx: number, e: React.PointerEvent) => {
    if (draggingIdx !== null) {
      const el = e.target as Element;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      setDraggingIdx(null);
      commitUndo();
    }
  };

  // --- 双击节点删除 ---
  const handleDoubleClickNode = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0 || idx === points.length - 1) return; // 保护首尾
    const newPoints = [...points];
    newPoints.splice(idx, 1);
    onChange(activeChannel, newPoints);
    commitUndo();
  };

  // --- 点击空白处加点 (改为右键) ---
  const handleSvgRightClick = (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止浏览器默认右键菜单
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    let y = 1 - ((e.clientY - rect.top) / rect.height);
    y = Math.max(0, Math.min(1, y));

    // 寻找插入位置
    if (x <= 0 || x >= 1) return;
    const newPoints = [...points, { x, y }];
    newPoints.sort((a, b) => a.x - b.x); // 绝对保证有序
    
    onChange(activeChannel, newPoints);
    commitUndo();
  };

  // --- SVG UI 生成 ---
  const getPathD = (pts: Point[]) => {
    if (!pts || pts.length < 2) return '';
    let d = `M ${pts[0].x * 100} ${(1 - pts[0].y) * 100} `;
    
    for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p0 = i > 0 ? pts[i - 1] : p1;
        const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

        const dx = p2.x - p1.x;
        // 算出切线斜率 (Hermite)
        const m1 = (p2.y - p0.y) / Math.max(0.001, p2.x - p0.x);
        const m2 = (p3.y - p1.y) / Math.max(0.001, p3.x - p1.x);

        const S = 0.5; // Tension matching backend
        // Bezier 控制点公式: C1 = P1 + m1 * dx / 3
        const cp1x = p1.x + dx / 3;
        const cp1y = p1.y + m1 * (dx / 3) * S;

        const cp2x = p2.x - dx / 3;
        const cp2y = p2.y - m2 * (dx / 3) * S;

        d += `C ${(cp1x * 100).toFixed(2)} ${((1 - cp1y) * 100).toFixed(2)}, ${(cp2x * 100).toFixed(2)} ${((1 - cp2y) * 100).toFixed(2)}, ${(p2.x * 100).toFixed(2)} ${((1 - p2.y) * 100).toFixed(2)} `;
    }
    return d;
  };

  const renderGrid = () => (
    <g className="grid">
      {/* 25% 刻度参考线 */}
      {[0.25, 0.5, 0.75].map(v => (
        <React.Fragment key={v}>
          <line x1={v * 100} y1="0" x2={v * 100} y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
          <line x1="0" y1={v * 100} x2="100" y2={v * 100} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
        </React.Fragment>
      ))}
      {/* 12.5% 细格参考线 (让画面更具专业感) */}
      {[0.125, 0.375, 0.625, 0.875].map(v => (
        <React.Fragment key={v}>
          <line x1={v * 100} y1="0" x2={v * 100} y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="0.15" />
          <line x1="0" y1={v * 100} x2="100" y2={v * 100} stroke="rgba(255,255,255,0.03)" strokeWidth="0.15" />
        </React.Fragment>
      ))}
      {/* 对角参考线 */}
      <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.2)" strokeWidth="0.3" strokeDasharray="3,3" />
    </g>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, userSelect: 'none' }}>
      
      {/* 频道选择器 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['master', 'red', 'green', 'blue'] as const).map(ch => (
          <div
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className="ios-hover-scale"
            style={{ 
              flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 11, cursor: 'pointer', borderRadius: 6,
              background: activeChannel === ch ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: activeChannel === ch ? colors[ch] : 'rgba(255,255,255,0.4)',
              fontWeight: activeChannel === ch ? 700 : 400,
              boxShadow: activeChannel === ch ? `0 2px 8px ${colors[ch]}20` : 'none',
              border: `1px solid ${activeChannel === ch ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
              transition: 'all 0.2s'
            }}
          >
            {ch === 'master' ? 'RGB / 明暗' : ch.toUpperCase()}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '-4px 0 -2px' }}>
        提示: 右键增加锚点, 鼠标拖拽, 双击锚点删除
      </div>

      {/* 坐标轴板 */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, rgba(10,10,15,0.9), rgba(15,15,22,0.9))', borderRadius: 8, aspectRatio: '1', position: 'relative', 
          border: '1px solid rgba(255,255,255,0.15)', padding: '4%', boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5)'
        }}
      >
        <svg 
          ref={svgRef} 
          viewBox="0 0 100 100" 
          style={{ width: '100%', height: '100%', overflow: 'visible', touchAction: 'none', cursor: 'crosshair' }}
          onContextMenu={handleSvgRightClick}
        >
          {renderGrid()}

          {/* 绘制其它失去焦点的曲线 */}
          {(['red', 'green', 'blue', 'master'] as const).filter(c => c !== activeChannel).map(ch => {
            const pts = ch === 'master' ? curveMaster : ch === 'red' ? curveRed : ch === 'green' ? curveGreen : curveBlue;
            return pts && pts.length >= 2 ? (
              <path key={ch} d={getPathD(pts)} fill="none" stroke={colors[ch]} strokeWidth="0.8" opacity={0.25} style={{ pointerEvents: 'none' }} />
            ) : null;
          })}

          {/* Main Curve */}
          <path d={getPathD(points)} fill="none" stroke={colors[activeChannel]} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />

          {/* 控制节点 */}
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x * 100}
              cy={(1 - pt.y) * 100}
              r={draggingIdx === i ? 3 : 2.5}
              fill={draggingIdx === i ? '#FFF' : '#1A1A1A'}
              stroke={colors[activeChannel]}
              strokeWidth={0.8}
              style={{ cursor: i === 0 || i === points.length - 1 ? 'ns-resize' : 'grab', transition: 'r 0.1s, fill 0.2s', outline: 'none' }}
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(i, e)}
              onDoubleClick={(e) => handleDoubleClickNode(i, e)}
            />
          ))}
        </svg>

        {/* 悬浮指示角标 */}
        <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', display: 'flex', width: '92%', justifyContent: 'space-between' }}>
           <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>黑/阴影</span>
           <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>灰/中间调</span>
           <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>白/高光</span>
        </div>
      </div>
    </div>
  );
};
