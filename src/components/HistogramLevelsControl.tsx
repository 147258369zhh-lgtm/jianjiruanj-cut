import React, { useEffect, useRef, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  imageUrl: string | undefined;
  levelInBlack?: number;  // 0-255
  levelInGamma?: number;  // 0.1-9.99
  levelInWhite?: number;  // 0-255
  onChange: (black: number, gamma: number, white: number) => void;
  onUndoCommit: () => void;
}

export const HistogramLevelsControl: React.FC<Props> = ({
  imageUrl,
  levelInBlack = 0,
  levelInGamma = 1.0,
  levelInWhite = 255,
  onChange,
  onUndoCommit
}) => {
  const [histogram, setHistogram] = useState<number[]>(new Array(256).fill(0));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingThumb, setDraggingThumb] = useState<'black'|'gamma'|'white'|null>(null);

  // Read image and build histogram
  useEffect(() => {
    if (!imageUrl) {
      setHistogram(new Array(256).fill(0));
      return;
    }
    const img = new Image();
    const processImage = () => {
      const cvs = canvasRef.current;
      if (!cvs || !img.complete || img.naturalWidth === 0) return;
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      cvs.width = 128;
      cvs.height = 128;
      ctx.drawImage(img, 0, 0, 128, 128);
      
      try {
        const idata = ctx.getImageData(0, 0, 128, 128).data;
        const hist = new Array(256).fill(0);
        for (let i = 0; i < idata.length; i += 4) {
          const luma = Math.round(0.299 * idata[i] + 0.587 * idata[i+1] + 0.114 * idata[i+2]);
          hist[Math.min(255, Math.max(0, luma))]++;
        }
        setHistogram(hist);
      } catch(e) { console.error('Error computing histogram (tainted canvas?)', e); }
    };

    img.onload = processImage;

    // Direct invocation to Tauri backend to read the absolute path, completely ignoring fetch/cors/C: restrictions.
    let purePath = imageUrl;
    if (purePath.startsWith('asset://localhost/')) purePath = purePath.replace('asset://localhost/', '');
    if (purePath.startsWith('http://asset.localhost/')) purePath = purePath.replace('http://asset.localhost/', '');
    if (purePath.startsWith('https://tauri.localhost/')) purePath = purePath.replace('https://tauri.localhost/', '');
    if (purePath.startsWith('http://tauri.localhost/')) purePath = purePath.replace('http://tauri.localhost/', '');
    try { purePath = decodeURIComponent(purePath); } catch(e) {}

    invoke('read_local_file', { path: purePath })
      .then((data: unknown) => {
        const bytes = data as number[];
        const blob = new Blob([new Uint8Array(bytes)]);
        img.src = URL.createObjectURL(blob);
      })
      .catch((err) => {
         console.warn("读取本地图片直方图失败:", err);
         img.src = imageUrl; // fallback
      });

  }, [imageUrl]);

  // Normalize histogram for SVG
  const normalizedHist = useMemo(() => {
    // Ignore the 0 array and find max count
    // Ignore the absolute peak (often pure black or pure white) for a better visualization of midtones if needed,
    // actually, let's keep it simple: just take the max value except 0 and 255
    let maxVal = 1;
    for(let i=1; i<255; i++) {
        if(histogram[i] > maxVal) maxVal = histogram[i];
    }
    // Boost a little
    return histogram.map(v => Math.min(1.0, v / (maxVal * 1.5)));
  }, [histogram]);

  const pathD = useMemo(() => {
    const pts = normalizedHist.map((v, i) => {
      const x = (i / 255) * 100;
      const y = 100 - (v * 100);
      return `${i===0?'M':'L'} ${x} ${y}`;
    });
    return pts.join(' ') + ' L 100 100 L 0 100 Z';
  }, [normalizedHist]);

  // Mouse logic
  // Gamma works as: math.pow(0.5, 1/gamma) = physical_mid_percentage
  const getGammaPos = (g: number) => {
    return Math.pow(0.5, 1 / Math.max(0.01, g));
  };
  const setGammaFromPos = (frac: number) => {
    const f = Math.max(0.01, Math.min(0.99, frac));
    const g = Math.log(0.5) / Math.log(f);
    return Math.max(0.1, Math.min(9.99, g));
  };

  const handlePointerDown = (e: React.PointerEvent, thumb: 'black'|'gamma'|'white') => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggingThumb(thumb);
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingThumb || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const rawVal = (x / rect.width) * 255;
    
    let nb = levelInBlack, ng = levelInGamma, nw = levelInWhite;
    
    if (draggingThumb === 'black') {
      nb = Math.round(Math.min(nw - 2, Math.max(0, rawVal)));
    } else if (draggingThumb === 'white') {
      nw = Math.round(Math.max(nb + 2, Math.min(255, rawVal)));
    } else if (draggingThumb === 'gamma') {
      const wPx = (nw / 255) * rect.width;
      const bPx = (nb / 255) * rect.width;
      const frac = (x - bPx) / (wPx - bPx);
      ng = setGammaFromPos(frac);
    }
    
    onChange(nb, ng, nw);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingThumb) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setDraggingThumb(null);
      onUndoCommit();
    }
  };

  const bPercent = (levelInBlack / 255) * 100;
  const wPercent = (levelInWhite / 255) * 100;
  const gFrac = getGammaPos(levelInGamma);
  const gPercent = bPercent + gFrac * (wPercent - bPercent);

  // Determine active visual state
  const isDefault = levelInBlack === 0 && levelInWhite === 255 && Math.abs(levelInGamma - 1.0) < 0.01;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, userSelect: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>对比度与色阶映射</span>
        {!isDefault && <span style={{ fontSize: 11, color: '#FCD34D', cursor: 'pointer' }} onClick={() => { onChange(0, 1.0, 255); onUndoCommit(); }}>重置</span>}
      </div>
      
      {/* Container */}
      <div 
        ref={containerRef}
        style={{ 
          height: 120, width: '100%', 
          position: 'relative', 
          cursor: draggingThumb ? 'ew-resize' : 'default',
        }}
        onPointerMove={handlePointerMove}
      >
        {/* Track / Histogram Background */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 1.0 }}>
            <path d={pathD} fill="#fff" stroke="none" />
          </svg>

        </div>
        
        {/* Bottom Line representation purely visual */}
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.05) 100%)' }} />

        {/* Black Thumb */}
        <div
          onPointerDown={e => handlePointerDown(e, 'black')}
          onPointerUp={handlePointerUp}
          style={{ position: 'absolute', bottom: -8, left: `${bPercent}%`, transform: 'translate(-50%, 0)', width: 12, height: 14, cursor: 'ew-resize', touchAction: 'none', zIndex: draggingThumb==='black'?10:1 }}
        >
          <svg viewBox="0 0 12 14" width="12" height="14" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
            <path d="M6 0 L12 5 L12 14 L0 14 L0 5 Z" fill="#111" stroke="#ccc" strokeWidth="1" />
          </svg>
        </div>
        
        {/* Gamma Thumb */}
        <div
          onPointerDown={e => handlePointerDown(e, 'gamma')}
          onPointerUp={handlePointerUp}
          style={{ position: 'absolute', bottom: -8, left: `${gPercent}%`, transform: 'translate(-50%, 0)', width: 12, height: 14, cursor: 'ew-resize', touchAction: 'none', zIndex: draggingThumb==='gamma'?10:1 }}
        >
          <svg viewBox="0 0 12 14" width="12" height="14" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
            <path d="M6 0 L12 5 L12 14 L0 14 L0 5 Z" fill="#777" stroke="#eee" strokeWidth="1" />
          </svg>
        </div>

        {/* White Thumb */}
        <div
          onPointerDown={e => handlePointerDown(e, 'white')}
          onPointerUp={handlePointerUp}
          style={{ position: 'absolute', bottom: -8, left: `${wPercent}%`, transform: 'translate(-50%, 0)', width: 12, height: 14, cursor: 'ew-resize', touchAction: 'none', zIndex: draggingThumb==='white'?10:1 }}
        >
          <svg viewBox="0 0 12 14" width="12" height="14" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
            <path d="M6 0 L12 5 L12 14 L0 14 L0 5 Z" fill="#fff" stroke="#333" strokeWidth="1" />
          </svg>
        </div>
      </div>
      
      {/* Values */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, color: '#aaa', padding: '0 4px' }}>
        <span style={{color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, minWidth: 26, textAlign: 'center'}}>{levelInBlack}</span>
        <span style={{color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, minWidth: 32, textAlign: 'center'}}>{levelInGamma.toFixed(2)}</span>
        <span style={{color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, minWidth: 26, textAlign: 'center'}}>{levelInWhite}</span>
      </div>
    </div>
  );
};
