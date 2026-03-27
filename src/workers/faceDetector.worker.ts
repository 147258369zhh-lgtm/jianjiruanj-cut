import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let faceDetector: FaceDetector | null = null;
let isInitializing = false;

const initDetector = async () => {
  if (faceDetector || isInitializing) return;
  isInitializing = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
        delegate: "CPU" // GPU WebGL might not be supported smoothly unconditionally in workers
      },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5
    });
    console.log('[MediaPipe Worker] Initialized FaceDetection Model Successfully');
  } catch (error) {
    console.error("[MediaPipe Worker] Failed to initialize:", error);
  } finally {
    isInitializing = false;
  }
};

// Start init
initDetector();

self.onmessage = async (e: MessageEvent) => {
  const { id, imageBitmap, width, height } = e.data;
  
  if (!faceDetector) {
    await initDetector();
  }

  if (!faceDetector || !imageBitmap) {
    self.postMessage({ id, focusX: 50, focusY: 50, found: false });
    return;
  }

  try {
    const detections = faceDetector.detect(imageBitmap);
    
    // Cleanup ImageBitmap
    if (imageBitmap.close) imageBitmap.close();

    if (detections.detections && detections.detections.length > 0) {
      // Find the most prominent face by area
      let mainFace = detections.detections[0];
      let maxArea = 0;
      for (const d of detections.detections) {
        if (!d.boundingBox) continue;
        const area = d.boundingBox.width * d.boundingBox.height;
        if (area > maxArea) { maxArea = area; mainFace = d; }
      }

      if (mainFace.boundingBox) {
        // Find absolute center point of bounding box
        const centerX = mainFace.boundingBox.originX + (mainFace.boundingBox.width / 2);
        const centerY = mainFace.boundingBox.originY + (mainFace.boundingBox.height / 2);
        
        // Convert strictly to relative 0-100 percentage
        const focusX = Math.round((centerX / width) * 100);
        const focusY = Math.round((centerY / height) * 100);

        self.postMessage({ id, focusX, focusY, found: true });
        return;
      }
    }
  } catch (err) {
    console.error('[MediaPipe Worker] Detection logic error:', err);
  }

  // Fallback if no faces found or errored out
  self.postMessage({ id, focusX: 50, focusY: 50, found: false });
};
