export const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v))
export const rand  = (a,b) => a + Math.random()*(b-a)
export const pick  = arr => arr[Math.floor(Math.random()*arr.length)]

/**
 * Convert tasks-vision BoundingBox (pixels) to % of video dimensions.
 * Tasks-Vision BoundingBox: { originX, originY, width, height } in pixels.
 */
export function tasksBoxToPercent(bb, vW, vH) {
  if (!bb || !vW || !vH) return null
  const x = (bb.originX / vW) * 100
  const y = (bb.originY / vH) * 100
  const w = (bb.width   / vW) * 100
  const h = (bb.height  / vH) * 100
  if (w < 2 || h < 2) return null
  return {
    x: clamp(x, 0, 98-w),
    y: clamp(y, 0, 98-h),
    w: clamp(w, 3, 88),
    h: clamp(h, 3, 88)
  }
}

/**
 * Lerp one box toward another — smooth tracking
 * t=0.25 gives cinematic lag, t=0.5 is snappy
 */
export function lerpBox(from, to, t) {
  if (!from) return { ...to }
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  }
}

/** Psychologically unsettling ghost zones */
export function generateFakeBox() {
  const zones = [
    () => ({ x:rand(3,16),  y:rand(8,30),  w:rand(12,19), h:rand(22,34) }), // far left
    () => ({ x:rand(72,84), y:rand(10,40), w:rand(11,18), h:rand(20,36) }), // far right
    () => ({ x:rand(4,14),  y:rand(60,72), w:rand(10,16), h:rand(17,25) }), // lower-left
    () => ({ x:rand(64,78), y:rand(24,54), w:rand(12,20), h:rand(22,34) }), // shoulder
    () => ({ x:rand(40,56), y:rand(3,14),  w:rand(8,13),  h:rand(11,18) }), // far-back center
  ]
  const b = pick(zones)()
  b.x = clamp(b.x, 2, 100-b.w-2)
  b.y = clamp(b.y, 2, 100-b.h-2)
  return b
}

export function fluctuateConf(base, spread=1.5) {
  return clamp(base + (Math.random()-0.5)*spread, 60, 99)
}
