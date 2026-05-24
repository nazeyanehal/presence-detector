/**
 * FakePresenceEngine v4
 *
 * Timing:
 *   First ghost : 20–35s  (long enough to feel real)
 *   Visible     : 0.7–1.5s (brief — glitch, not performance)
 *   Gap         : 28–60s  (rare — unsettling, not annoying)
 *   Escalation  : after 2min, 5% chance of second ghost
 */
import { generateFakeBox, fluctuateConf, rand } from '../utils/detectionHelpers.js'

export class FakePresenceEngine {
  constructor(onChange) {
    this.onChange   = onChange
    this.detections = []
    this.running    = false
    this.escalation = false
    this._id        = 0
    this._baseConf  = rand(84, 93)
    this._timer     = null
    this._raf       = null
    this._t0        = Date.now()
  }

  start() {
    this.running = true
    const d = rand(20000, 35000)
    console.log(`[Ghost] First in ${(d/1000).toFixed(1)}s`)
    this._timer = setTimeout(() => this._cycle(), d)
    setTimeout(() => { this.escalation = true }, 120000)
    this._drift()
  }

  stop() {
    this.running = false
    clearTimeout(this._timer)
    cancelAnimationFrame(this._raf)
    this.detections = []
    this.onChange([])
  }

  _cycle() {
    if (!this.running) return
    const box  = generateFakeBox()
    const id   = ++this._id
    const conf = this._baseConf + rand(-4, 4)

    const det = {
      id, type:'fake',
      box:{...box}, _origin:{...box},
      confidence:conf, displayConfidence:conf,
      flickering: Math.random() < 0.22,
      label:'Person detected'
    }
    this.detections = [det]
    this.onChange([...this.detections])

    // Rare second ghost
    if (this.escalation && Math.random() < 0.05) {
      setTimeout(() => {
        if (!this.running) return
        const b2 = generateFakeBox()
        const g2 = {
          id:++this._id, type:'fake',
          box:{...b2}, _origin:{...b2},
          confidence:rand(68,80), displayConfidence:rand(68,80),
          flickering:true, label:'Person detected'
        }
        this.detections = [...this.detections, g2]
        this.onChange([...this.detections])
        setTimeout(() => {
          if (!this.running) return
          this.detections = this.detections.filter(d => d.id !== g2.id)
          this.onChange([...this.detections])
        }, rand(600, 1100))
      }, rand(600, 1400))
    }

    const vis = rand(700, 1500)
    setTimeout(() => {
      if (!this.running) return
      this.detections = this.detections.filter(d => d.id !== id)
      this.onChange([...this.detections])
      const gap = rand(28000, 60000)
      console.log(`[Ghost] Next in ${(gap/1000).toFixed(1)}s`)
      this._timer = setTimeout(() => this._cycle(), gap)
    }, vis)
  }

  _drift() {
    if (!this.running) return
    const t = (Date.now() - this._t0) / 1000
    this.detections = this.detections.map(d => ({
      ...d,
      box:{
        ...d._origin,
        x: d._origin.x + Math.sin(t*0.35 + d.id*1.7)*0.2,
        y: d._origin.y + Math.cos(t*0.28 + d.id*1.7+0.9)*0.15,
      },
      displayConfidence: fluctuateConf(d.confidence, d.flickering ? 4 : 1.2)
    }))
    if (this.detections.length > 0) this.onChange([...this.detections])
    this._raf = requestAnimationFrame(() => setTimeout(() => this._drift(), 130))
  }
}
