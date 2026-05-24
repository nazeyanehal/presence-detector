/**
 * TrackingEngine
 *
 * Wraps raw MediaPipe detections with intelligent persistence:
 *
 *   ACQUIRING  → no confirmed detection yet
 *   TRACKING   → face confirmed, box following
 *   COASTING   → face temporarily lost, holding last position,
 *                confidence decaying (97→85→70→fade)
 *   LOST       → fully faded, clearing
 *
 * This makes the system feel like a real surveillance AI:
 * it doesn't instantly forget — it holds, decays, then releases.
 *
 * Motion layer: if frame-diff energy is high but face is not found,
 * we hold COASTING longer and show a "motion detected" advisory.
 */

import { lerpBox, clamp } from '../utils/detectionHelpers.js'

// How many frames to hold last known position after losing the face
const COAST_FRAMES  = 18   // ~0.6s at 30fps
// How much to decay confidence per coast frame
const COAST_DECAY   = 1.8  // percentage points per frame
// Lerp speed — cinematic lag
const LERP_FAST     = 0.30  // normal tracking
const LERP_SLOW     = 0.10  // coasting (drifts gently)
// History frames for positional averaging
const AVG_HISTORY   = 4
// Min confidence from MediaPipe to accept
const CONF_FLOOR    = 0.60

export const TrackState = {
  ACQUIRING : 'ACQUIRING',
  TRACKING  : 'TRACKING',
  COASTING  : 'COASTING',
  LOST      : 'LOST',
}

export class TrackingEngine {
  constructor() {
    // Smoothed output box (% coords)
    this.displayBox  = null
    // Raw averaged input box
    this._avgBox     = null
    // Rolling input history
    this._history    = []
    // Current displayed confidence %
    this.confidence  = 0
    // Miss counter
    this._misses     = 0
    // State machine
    this.state       = TrackState.ACQUIRING
    // Motion energy (0–1)
    this.motionEnergy = 0
    // Previous frame pixel data for diff
    this._prevPixels = null
    this._motionCanvas = null
    this._motionCtx    = null
  }

  /**
   * Feed one detection result + current video element.
   * Returns { box, confidence, state, motionEnergy }
   */
  update(detections, videoEl) {
    // ── Motion analysis ──────────────────────────────────────────────────────
    this._updateMotion(videoEl)

    // ── Pick best detection ──────────────────────────────────────────────────
    const best = this._bestDetection(detections)

    if (best) {
      // ── DETECTION HIT ────────────────────────────────────────────────────
      this._misses = 0

      // Add to history, cap size
      this._history.push(best.box)
      if (this._history.length > AVG_HISTORY) this._history.shift()

      // Average the history
      const n = this._history.length
      const avg = this._history.reduce((acc, b) => ({
        x: acc.x + b.x/n, y: acc.y + b.y/n,
        w: acc.w + b.w/n, h: acc.h + b.h/n
      }), { x:0, y:0, w:0, h:0 })

      // Lerp display box toward averaged target
      this.displayBox = lerpBox(this.displayBox, avg, LERP_FAST)
      this._avgBox    = avg

      // Confidence climbs to raw value fast
      const targetConf = best.rawConf * 100
      this.confidence  = this.confidence
        ? clamp(this.confidence + (targetConf - this.confidence) * 0.35, 60, 99)
        : targetConf

      this.state = TrackState.TRACKING

    } else {
      // ── DETECTION MISS ────────────────────────────────────────────────────
      this._misses++

      if (this._misses <= COAST_FRAMES) {
        // ── COASTING: hold last position, decay confidence ──────────────────
        this.state = TrackState.COASTING

        // Gentle drift during coast (not stationary — feels like AI still probing)
        if (this._avgBox && this.displayBox) {
          this.displayBox = lerpBox(this.displayBox, this._avgBox, LERP_SLOW)
        }

        // Decay confidence — faster if no motion
        const decayRate = this.motionEnergy > 0.15
          ? COAST_DECAY * 0.6   // motion present → decay slower (AI uncertain)
          : COAST_DECAY         // no motion → decay faster
        this.confidence = clamp(this.confidence - decayRate, 0, 99)

        if (this.confidence <= 0) {
          this._clearTrack()
        }

      } else {
        // ── LOST ───────────────────────────────────────────────────────────
        this._clearTrack()
      }
    }

    return this._output()
  }

  _bestDetection(detections) {
    if (!detections?.length) return null
    const valid = detections
      .filter(d => (d.categories?.[0]?.score ?? 0) >= CONF_FLOOR)
      .sort((a,b) => (b.categories?.[0]?.score ?? 0) - (a.categories?.[0]?.score ?? 0))
    if (!valid.length) return null

    const d   = valid[0]
    const bb  = d.boundingBox
    const rawConf = d.categories?.[0]?.score ?? 0.7
    return { box: { x:bb.originX, y:bb.originY, w:bb.width, h:bb.height }, rawConf }
  }

  /**
   * Motion detection via downsampled frame diff.
   * Runs on a tiny 40×30 canvas — essentially free.
   */
  _updateMotion(video) {
    if (!video || video.readyState < 2 || video.videoWidth === 0) return
    if (!this._motionCanvas) {
      this._motionCanvas = document.createElement('canvas')
      this._motionCanvas.width  = 40
      this._motionCanvas.height = 30
      this._motionCtx = this._motionCanvas.getContext('2d', { willReadFrequently: true })
    }
    const ctx = this._motionCtx
    ctx.drawImage(video, 0, 0, 40, 30)
    const curr = ctx.getImageData(0, 0, 40, 30).data
    if (this._prevPixels) {
      let diff = 0
      for (let i = 0; i < curr.length; i += 4) {
        diff += Math.abs(curr[i] - this._prevPixels[i])
            +  Math.abs(curr[i+1] - this._prevPixels[i+1])
            +  Math.abs(curr[i+2] - this._prevPixels[i+2])
      }
      // Normalize to 0–1
      this.motionEnergy = clamp(diff / (40*30*3*255*0.4), 0, 1)
    }
    this._prevPixels = new Uint8ClampedArray(curr)
  }

  _clearTrack() {
    this.displayBox  = null
    this._avgBox     = null
    this._history    = []
    this.confidence  = 0
    this._misses     = 0
    this.state       = TrackState.LOST
  }

  _output() {
    return {
      box:          this.displayBox,
      confidence:   Math.round(this.confidence),
      state:        this.state,
      motionEnergy: this.motionEnergy,
    }
  }

  destroy() {
    this._prevPixels   = null
    this._motionCanvas = null
    this._motionCtx    = null
  }
}
