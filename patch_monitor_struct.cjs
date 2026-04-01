const fs = require('fs');

const file = 'src/components/MonitorPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// The video block to replace
const oldVideoBlock = `                {monitorSrc.type === 'video' ? (
                  <div key={\`video-anim-wrap-\${monitorSrc.currentItem?.id}-\${animResetKey}\`} style={{
                    position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
                    transform: \`translate(\${monitorSrc.currentItem?.posX || 0}%, \${monitorSrc.currentItem?.posY || 0}%) rotate(\${monitorSrc.currentItem?.rotation || 0}deg) scale(\${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, \${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})\`,
                    opacity: monitorSrc.currentItem?.opacity ?? 1,
                    mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
                    animation: buildMediaAnimation(monitorSrc.currentItem),
                    transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                    clipPath: getClipPath(monitorSrc.currentItem),
                  }}>`;

const newVideoBlock = `                {monitorSrc.type === 'video' ? (
                  <div key={\`video-anim-wrap-\${monitorSrc.currentItem?.id}-\${animResetKey}\`} style={{ 
                    position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    animation: buildMediaAnimation(monitorSrc.currentItem)
                  }}>
                    <div style={{
                      position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
                      transform: \`translate(\${monitorSrc.currentItem?.posX || 0}%, \${monitorSrc.currentItem?.posY || 0}%) rotate(\${monitorSrc.currentItem?.rotation || 0}deg) scale(\${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, \${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})\`,
                      opacity: monitorSrc.currentItem?.opacity ?? 1,
                      mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
                      transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                      clipPath: getClipPath(monitorSrc.currentItem),
                    }}>`;

// The img block to replace
const oldImgBlock = `                ) : (
                  <div key={\`img-anim-wrap-\${monitorSrc.currentItem?.id}-\${animResetKey}\`} style={{
                    position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
                    transform: \`translate(\${monitorSrc.currentItem?.posX || 0}%, \${monitorSrc.currentItem?.posY || 0}%) rotate(\${monitorSrc.currentItem?.rotation || 0}deg) scale(\${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, \${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})\`,
                    opacity: monitorSrc.currentItem?.opacity ?? 1,
                    mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
                    animation: buildMediaAnimation(monitorSrc.currentItem),
                    transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                    clipPath: getClipPath(monitorSrc.currentItem),
                  }}>`;

const newImgBlock = `                ) : (
                  <div key={\`img-anim-wrap-\${monitorSrc.currentItem?.id}-\${animResetKey}\`} style={{ 
                    position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    animation: buildMediaAnimation(monitorSrc.currentItem)
                  }}>
                    <div style={{
                      position: 'relative', display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
                      transform: \`translate(\${monitorSrc.currentItem?.posX || 0}%, \${monitorSrc.currentItem?.posY || 0}%) rotate(\${monitorSrc.currentItem?.rotation || 0}deg) scale(\${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipX ? -1 : 1)}, \${(monitorSrc.currentItem?.zoom || 1) * (monitorSrc.currentItem?.flipY ? -1 : 1)})\`,
                      opacity: monitorSrc.currentItem?.opacity ?? 1,
                      mixBlendMode: (monitorSrc.currentItem?.blendMode as any) || 'normal',
                      transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                      clipPath: getClipPath(monitorSrc.currentItem),
                    }}>`;

content = content.replace(oldVideoBlock, newVideoBlock);
content = content.replace(oldImgBlock, newImgBlock);

// We must also close the newly added div for both blocks
// Block 1 (video) ends around line 343:
//                     ) : null}
//                   </div>
//                 ) : (
const videoEndBefore = `                    ) : null}
                  </div>
                ) : (`;
const videoEndAfter = `                    ) : null}
                    </div>
                  </div>
                ) : (`;
content = content.replace(videoEndBefore, videoEndAfter);

// Block 2 (img) ends around line 386 or so
//                     ) : null}
//                   </div>
//                 )}
const imgEndBefore = `                    ) : null}
                  </div>
                )}`;
const imgEndAfter = `                    ) : null}
                    </div>
                  </div>
                )}`;
content = content.replace(imgEndBefore, imgEndAfter);

fs.writeFileSync(file, content);
console.log('MonitorPanel animation separation patched!');
