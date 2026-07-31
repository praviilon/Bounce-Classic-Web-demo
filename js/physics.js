/* ==========================================================
   Physics helpers
   Простейшая, но устойчивая коллизия "окружность vs прямоугольник",
   используемая для всех твёрдых платформ уровня.
   ========================================================== */

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t){
  return a + (b - a) * t;
}

function rectsOverlap(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Проверка попадания точки/круга в прямоугольник (для триггеров: вода, насосы, шипы, кольца и т.п.) */
function circleOverlapsRect(cx, cy, r, rect){
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx*dx + dy*dy) < (r*r);
}

/**
 * Вычисляет разрешение коллизии круга с твёрдым прямоугольником.
 * Возвращает null, если столкновения нет, иначе
 * {normal:{x,y}, penetration} — ось выталкивания и глубина проникновения.
 */
function resolveCircleRect(cx, cy, r, rect){
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - closestX;
  let dy = cy - closestY;
  let distSq = dx*dx + dy*dy;

  if(distSq >= r*r) return null;

  // Центр круга внутри прямоугольника — выталкиваем по кратчайшей стороне.
  if(distSq === 0){
    const left = (cx - rect.x);
    const right = (rect.x + rect.w - cx);
    const top = (cy - rect.y);
    const bottom = (rect.y + rect.h - cy);
    const min = Math.min(left, right, top, bottom);
    if(min === left)  return { normal:{x:-1,y:0}, penetration: r + left };
    if(min === right) return { normal:{x:1, y:0}, penetration: r + right };
    if(min === top)   return { normal:{x:0,y:-1}, penetration: r + top };
    return { normal:{x:0,y:1}, penetration: r + bottom };
  }

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  return { normal:{x:nx, y:ny}, penetration: r - dist };
}
