import React from 'react';

export const DropOverlay: React.FC<{ isDragOver: boolean }> = ({ isDragOver }) => {
  if (!isDragOver) return null;

  return (
    <div className="drop-overlay">
      <div className="drop-overlay-icon">📥</div>
      <div className="drop-overlay-text">释放以导入素材</div>
      <div className="drop-overlay-subtext">支持 PNG / JPG / WEBP / DNG / MP3 / WAV / M4A</div>
    </div>
  );
};
