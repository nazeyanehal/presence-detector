import { useEffect, useRef } from 'react'

/**
 * ParticleBackground
 * Canvas-based: zero React re-renders, purely imperative.
 * 60 slow-moving dim particles + faint red connection lines + radial ambient.
 */
export function ParticleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, W, H

    const resize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Sparse, slow particles
    const pts = Array.from({ length: 58 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.05 + 0.15,
      vx: (Math.random()-0.5) * 0.11,
      vy: (Math.random()-0.5) * 0.08,
      a: Math.random() * 0.16 + 0.03,
      ph: Math.random() * Math.PI * 2,
    }))

    let t = 0
    const draw = () => {
      t += 0.007
      ctx.clearRect(0, 0, W, H)

      // Deep background fill
      ctx.fillStyle = '#050507'
      ctx.fillRect(0, 0, W, H)

      // Ambient warm center radial
      const g = ctx.createRadialGradient(W/2, H*0.48, 0, W/2, H*0.48, W*0.6)
      g.addColorStop(0,   'rgba(28,0,2,0.22)')
      g.addColorStop(0.4, 'rgba(10,0,3,0.1)')
      g.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)

      // Move + draw particles
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        const alpha = p.a * (0.55 + 0.45 * Math.sin(t + p.ph))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(195,175,175,${alpha.toFixed(3)})`
        ctx.fill()
      }

      // Faint connection lines (proximity only)
      for (let i = 0; i < pts.length; i++) {
        for (let j = i+1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d  = dx*dx + dy*dy
          if (d < 8100) { // 90px²
            const a = (1 - d/8100) * 0.038
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(255,42,42,${a.toFixed(3)})`
            ctx.lineWidth   = 0.5
            ctx.stroke()
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas ref={canvasRef}
      style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}
    />
  )
}
