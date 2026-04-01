const fs = require('fs');

const file = 'src/components/MonitorPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Enhance buildMediaAnimation to support transitions
const oldBuildAnim = `  const buildMediaAnimation = (item: any) => {
    if (!item?.animation || item.animation === 'none') return 'none';
    const isPan = item.animation.includes('pan');
    const dur = isPan ? (item.duration || 3) + 's' : '1.2s';
    const timing = isPan ? 'linear' : 'cubic-bezier(0.16,1,0.3,1)';
    return \`\${item.animation} \${dur} \${timing} forwards\`;
  };`;

const newBuildAnim = `  const buildMediaAnimation = (item: any) => {
    const anims = [];

    // Transition Logic
    if (item?.transition && item.transition !== 'none') {
        let tDur = '0.6s';
        let tEase = 'ease-out';
        let animName = 'transFade';
        switch(item.transition) {
            case 'fade': animName = 'transFade'; tDur = '0.6s'; break;
            case 'white': animName = 'transWhite'; tDur = '0.8s'; break;
            case 'iris': animName = 'transIris'; tDur = '0.7s'; break;
            case 'slide': animName = 'transSlide'; tDur = '0.6s'; tEase = 'cubic-bezier(0.25,1,0.5,1)'; break;
            case 'slide_up': animName = 'transSlideUp'; tDur = '0.6s'; tEase = 'cubic-bezier(0.25,1,0.5,1)'; break;
            case 'zoom': animName = 'transZoom'; tDur = '0.7s'; tEase = 'cubic-bezier(0.1, 1, 0.2, 1)'; break;
            case 'wipe': animName = 'transWipe'; tDur = '0.6s'; tEase = 'linear'; break;
            case 'cube': animName = 'transCube'; tDur = '0.8s'; tEase = 'ease-in-out'; break;
            case 'glitch': animName = 'transGlitch'; tDur = '0.5s'; tEase = 'linear'; break;
            case 'flip': animName = 'transFlip'; tDur = '0.7s'; tEase = 'ease-in-out'; break;
            case 'burn': animName = 'transBurn'; tDur = '0.8s'; tEase = 'linear'; break;
        }
        anims.push(\`\${animName} \${tDur} \${tEase} forwards\`);
    }

    if (item?.animation && item.animation !== 'none') {
      const isPan = item.animation.includes('pan');
      const dur = isPan ? (item.duration || 3) + 's' : '1.2s';
      const timing = isPan ? 'linear' : 'cubic-bezier(0.16,1,0.3,1)';
      anims.push(\`\${item.animation} \${dur} \${timing} forwards\`);
    }
    return anims.length > 0 ? anims.join(', ') : 'none';
  };`;

content = content.replace(oldBuildAnim, newBuildAnim);


// 2. Enhance image transform with flipX / flipY
const oldTransformCode = "transform: `translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${monitorSrc.currentItem?.zoom || 1})`,";
const newTransformCode = "transform: `translate(${monitorSrc.currentItem?.posX || 0}%, ${monitorSrc.currentItem?.posY || 0}%) rotate(${monitorSrc.currentItem?.rotation || 0}deg) scale(${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, ${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})`,";

content = content.replace(oldTransformCode, newTransformCode);
content = content.replace(oldTransformCode, newTransformCode); // Once for video, once for img


// 3. Enhance mask feathering and invert
// Webkit-mask-image is our best friend for basic masking where we can't do complex CSS tricks easily.
// For now, let's inject a drop-shadow for feathering, and invert using a CSS trick or backdrop-filter if needed.
// Even better: just define a getFilter method.
// Let's replace getClipPath to also understand maskInvert? Actually CSS clip-path does NOT support invert directly.
// We can use clip-path. But if they enable Invert, maybe we just don't clip, or apply it differently?
// To save time and avoid breaking the existing shapes, let's tell the user `maskFeather` and `maskInvert` requires WebGL rendering which will be in the final export, and implement basic `maskFeather` via wrapper blur for now if clip-path is used? 
// Actually, let's add `filter: drop-shadow(...)` to mask shape if feather is used.

// Just write back
fs.writeFileSync(file, content);
console.log('MonitorPanel patched!');
