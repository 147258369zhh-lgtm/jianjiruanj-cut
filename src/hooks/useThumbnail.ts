import { useState, useEffect } from 'react';
import { globalThumbnailGenerator } from '../utils/thumbnailGenerator';

export function useThumbnail(src: string | undefined, timeOffset: number = 0.1) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setThumbUrl(null);
      return;
    }

    let isMounted = true;
    
    globalThumbnailGenerator.getThumbnail(src, timeOffset)
      .then(url => {
        if (isMounted) setThumbUrl(url);
      })
      .catch(() => {
        // 如果提取失败，保持 null，由外部决定要展示的 UI
        // console.error(`Thumbnail Error for ${src} at ${timeOffset}:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [src, timeOffset]);

  return thumbUrl;
}
