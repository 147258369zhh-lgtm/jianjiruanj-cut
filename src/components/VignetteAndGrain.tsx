import React from 'react';

interface VignetteAndGrainProps {
  vignette?: number;
  grain?: number;
  width: number;
  height: number;
}

export const VignetteAndGrain = React.memo(({ vignette, grain, width, height }: VignetteAndGrainProps) => {
  if (width <= 0) return null;
  return (
    <>
      {vignette ? (
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 5, borderRadius: 12, overflow: 'hidden',
          width, height,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          mixBlendMode: vignette > 0 ? 'multiply' : 'screen',
          background: `radial-gradient(ellipse at center, 
            transparent 0%, 
            transparent ${Math.max(0, 40 - Math.abs(vignette)*30)}%, 
            rgba(${vignette > 0 ? '0,0,0' : '255,255,255'}, ${Math.abs(vignette) * 0.15}) ${Math.max(30, 65 - Math.abs(vignette)*20)}%, 
            rgba(${vignette > 0 ? '0,0,0' : '255,255,255'}, ${Math.abs(vignette) * 0.5}) ${Math.max(50, 85 - Math.abs(vignette)*10)}%, 
            rgba(${vignette > 0 ? '0,0,0' : '255,255,255'}, ${Math.abs(vignette)}) 110%)`
        }} />
      ) : null}
      {grain ? (
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 6, borderRadius: 12, overflow: 'hidden',
          width, height,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          opacity: grain, mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
        }} />
      ) : null}
    </>
  );
});
