export const getClipPath = (item: any) => {
  if (item?.maskShape && item.maskShape !== 'none') {
    switch (item.maskShape) {
      case 'circle': return 'circle(50% at 50% 50%)';
      case 'ellipse': return 'ellipse(45% 35% at 50% 50%)';
      case 'heart': return 'polygon(50% 15%, 61% 0%, 85% 0%, 100% 15%, 100% 38%, 50% 100%, 0% 38%, 0% 15%, 15% 0%, 39% 0%)';
      case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
      case 'triangle': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
      case 'rhombus': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'hexagon': return 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)';
    }
  }
  return item?.cropPos ? `inset(${item.cropPos.y}% ${100 - item.cropPos.x - item.cropPos.width}% ${100 - item.cropPos.y - item.cropPos.height}% ${item.cropPos.x}%)` : 'none';
};
