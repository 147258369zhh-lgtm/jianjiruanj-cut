import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;
let initPromise: Promise<void> | null = null;

const initDetector = (): Promise<void> => {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/mediapipe/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        runningMode: "IMAGE",
        numFaces: 5
      });
      console.log('[MediaPipe Worker] Initialized FaceLandmarker Model Successfully');
    } catch (error) {
      console.error("[MediaPipe Worker] Failed to initialize FaceLandmarker:", error);
      initPromise = null; // allow retry
    }
  })();
  
  return initPromise;
};

// Start init
initDetector();

// -- Helper: High Quality Downscale & 64-bit Difference Hash (dHash) --
// This is the industry standard for robustness against compression and slight shifts.
const computeDHash64 = (pixels: Uint8ClampedArray, width: number, height: number): string => {
  const canvas = new OffscreenCanvas(9, 8); // 9 columns to get 8 differences per row
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;

  const tmpCanvas = new OffscreenCanvas(width, height);
  const tmpCtx = tmpCanvas.getContext('2d')!;
  tmpCtx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);

  ctx.drawImage(tmpCanvas, 0, 0, 9, 8);
  const imgData = ctx.getImageData(0, 0, 9, 8).data;

  const gray = new Uint8Array(72);
  for (let i = 0; i < 72; i++) {
    gray[i] = 0.299 * imgData[i * 4] + 0.587 * imgData[i * 4 + 1] + 0.114 * imgData[i * 4 + 2];
  }

  let hash = 'D64_'; // New prefix
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const idx = y * 9 + x;
      hash += gray[idx] >= gray[idx + 1] ? '1' : '0';
    }
  }
  return hash;
};

const calculateMeanBrightness = (pixels: Uint8ClampedArray): number => {
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
  }
  return total / (pixels.length / 4);
};

// -- Helper: Calculate Variance of Laplacian (Blur Detection) --
const calculateSharpnessVal = (gray: Float32Array, w: number, h: number): number => {
  let sumLaplacian = 0;
  let sqSumLaplacian = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let val = 
        gray[(y - 1) * w + x] +
        gray[y * w + (x - 1)] +
        gray[y * w + (x + 1)] +
        gray[(y + 1) * w + x] -
        4 * gray[y * w + x];
      sumLaplacian += val;
      sqSumLaplacian += val * val;
    }
  }
  const count = (w - 2) * (h - 2);
  const mean = sumLaplacian / count;
  return (sqSumLaplacian / count) - (mean * mean);
};

self.onmessage = async (e: MessageEvent) => {
  const { id, imageBitmap } = e.data;
  
  if (!faceLandmarker) {
    await initDetector();
  }

  if (!imageBitmap) {
    self.postMessage({ id, focusX: 50, focusY: 50, found: false });
    return;
  }

  try {
    // 1. One Time Downscale to 400px for both Sharpness and Hash (anti-aliasing)
    const scale = Math.min(1, 400 / imageBitmap.width);
    const w = Math.max(3, Math.round(imageBitmap.width * scale));
    const h = Math.max(3, Math.round(imageBitmap.height * scale));
    
    const baseCanvas = new OffscreenCanvas(w, h);
    const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true })!;
    baseCtx.imageSmoothingEnabled = true;
    baseCtx.imageSmoothingQuality = 'high';
    baseCtx.drawImage(imageBitmap, 0, 0, w, h);
    
    const baseImgData = baseCtx.getImageData(0, 0, w, h).data;
    
    // 2. Compute 64-bit robust dHash
    const dHash = computeDHash64(baseImgData, w, h);
    
    // 3. Compute Sharpness & Brightness
    const grayFloat = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      grayFloat[i] = 0.299 * baseImgData[i * 4] + 0.587 * baseImgData[i * 4 + 1] + 0.114 * baseImgData[i * 4 + 2];
    }
    const sharpness = calculateSharpnessVal(grayFloat, w, h);
    const meanBrightness = calculateMeanBrightness(baseImgData);

    // 4. Ultimate Score Logic
    let sharpnessScore = sharpness;
    let hasFace = false;
    let focusX = 50;
    let focusY = 50;

    // Only attempt Face Detection if the Google Model was successfully downloaded
    if (faceLandmarker) {
      const detections = faceLandmarker.detect(imageBitmap);

      if (detections.faceBlendshapes && detections.faceBlendshapes.length > 0 && detections.faceLandmarks.length > 0) {
        hasFace = true;
        let worstBlinkScore = 0;
        let bestSmileScore = 0;
        
        for (const blendshapes of detections.faceBlendshapes) {
          let eyeBlinkL = 0, eyeBlinkR = 0;
          let smileL = 0, smileR = 0;
          for (const b of blendshapes.categories) {
            if (b.categoryName === 'eyeBlinkLeft') eyeBlinkL = b.score;
            if (b.categoryName === 'eyeBlinkRight') eyeBlinkR = b.score;
            if (b.categoryName === 'mouthSmileLeft') smileL = b.score;
            if (b.categoryName === 'mouthSmileRight') smileR = b.score;
          }
          
          const blink = Math.max(eyeBlinkL, eyeBlinkR);
          if (blink > worstBlinkScore) worstBlinkScore = blink;
          
          const smile = Math.max(smileL, smileR);
          if (smile > bestSmileScore) bestSmileScore = smile;
        }
        
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const pt of detections.faceLandmarks[0]) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        
        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;
        focusX = Math.round(centerX * 100);
        focusY = Math.round(centerY * 100);
        
        const areaPct = (maxX - minX) * (maxY - minY);
        sharpnessScore += 2000 + (areaPct * 10000);
        
        if (bestSmileScore > 0.5) sharpnessScore += 5000;
        if (worstBlinkScore > 0.45) sharpnessScore -= 1000000;
      }
    }

    if (imageBitmap.close) imageBitmap.close();

    self.postMessage({ 
      id, 
      focusX, 
      focusY, 
      found: hasFace, 
      dHash, 
      sharpnessScore,
      meanBrightness,
      aspectRatio: imageBitmap.width / imageBitmap.height
    });
  } catch (err) {
    console.error('[MediaPipe Worker] Logic error:', err);
    self.postMessage({ id, focusX: 50, focusY: 50, found: false, dHash: '0'.repeat(256), sharpnessScore: 0 });
  }
};


