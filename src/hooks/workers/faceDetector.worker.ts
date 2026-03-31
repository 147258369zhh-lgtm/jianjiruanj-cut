// faceDetector.worker.ts - 人脸检测 Web Worker
// 使用简单的肤色检测算法定位人脸焦点区域

self.onmessage = async (e: MessageEvent) => {
  const { id, imageUrl } = e.data;

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      self.postMessage({ id, focusX: 0.5, focusY: 0.5, found: false });
      return;
    }

    // 缩小尺寸加速分析
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 基于肤色检测的简易焦点定位
    let sumX = 0, sumY = 0, count = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];

        // 肤色检测 (基于 RGB 经验值)
        if (r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            (r - g) > 15 &&
            Math.abs(r - g) > 15 &&
            r - b > 15) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count > (w * h * 0.01)) { // 至少 1% 的像素是肤色
      const focusX = sumX / count / w;
      const focusY = sumY / count / h;
      self.postMessage({ id, focusX, focusY, found: true });
    } else {
      // 没有检测到人脸区域，返回中心
      self.postMessage({ id, focusX: 0.5, focusY: 0.5, found: false });
    }
  } catch {
    self.postMessage({ id, focusX: 0.5, focusY: 0.5, found: false });
  }
};
