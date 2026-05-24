import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DetectionOverlay } from './DetectionOverlay.jsx'
import { FakePresenceEngine } from './FakePresenceEngine.js'
import { TrackingEngine, TrackState } from '../utils/TrackingEngine.js'
import { tasksBoxToPercent } from '../utils/detectionHelpers.js'

/**
 * CameraFeed v4
 *
 * Detection pipeline:
 *   @mediapipe/tasks-vision FaceDetector
 *     ↓ detectForVideo() synchronous — no async race conditions
 *     ↓ BoundingBox in pixels → tasksBoxToPercent() → mirror X
 *     ↓ Detection.categories[0].score — actual confidence (was missing in legacy)
 *   TrackingEngine
 *     ↓ TRACKING / COASTING / LOST state machine
 *     ↓ lerpBox() smooth interpolation + history averaging
 *     ↓ Decaying confidence on loss (97→85→70→fade)
 *     ↓ Motion layer: frame-diff energy on 40×30 canvas
 *   FakePresenceEngine (independent)
 *     ↓ Rare, timed ghost detections (20–35s first, 28–60s gaps)
 *
 * HUD chrome: state banners, motion indicator, FPS, AI status
 */

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

export function CameraFeed({ videoRef, setVideoRef, status, isRecording, recSeconds }) {
  const fakeEngineRef = useRef(null)
  const trackerRef    = useRef(null)
  const detectorRef   = useRef(null)
  const rafRef        = useRef(null)
  const detStateRef   = useRef({ real:[], fake:[] })

  const [allDetections, setAllDetections] = useState([])
  const [fps,           setFps]           = useState(0)
  const [timestamp,     setTimestamp]     = useState('')
  const [frameCount,    setFrameCount]    = useState(0)
  const [mpStatus,      setMpStatus]      = useState('loading')  // loading|ok|fallback
  const [trackState,    setTrackState]    = useState(TrackState.ACQUIRING)
  const [motionLevel,   setMotionLevel]   = useState(0) // 0–1

  const fpsRef = useRef({ n:0, last:Date.now() })

  // Stable merge — avoids stale closures in RAF callbacks
  const mergeRef = useRef(null)
  mergeRef.current = useCallback((type, value) => {
    detStateRef.current = { ...detStateRef.current, [type]: value }
    setAllDetections([...detStateRef.current.real, ...detStateRef.current.fake])
  }, [])

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setTimestamp(new Date().toISOString().replace('T',' ').slice(0,19))
      setFrameCount(f => (f+1) % 9999)
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // ── Ghost engine ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'active') return
    const eng = new FakePresenceEngine(fakes => mergeRef.current('fake', fakes))
    fakeEngineRef.current = eng
    eng.start()
    return () => { eng.stop(); fakeEngineRef.current = null }
  }, [status])

  // ── Detection + Tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'active') return
    let destroyed = false

    const tracker = new TrackingEngine()
    trackerRef.current = tracker

    const initDetector = async () => {
      try {
        console.log('[Detection] Loading @mediapipe/tasks-vision...')
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')

        const vision = await FilesetResolver.forVisionTasks(WASM_CDN)

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55,
          minSuppressionThreshold: 0.4
        })

        if (destroyed) { detector.close(); return }
        detectorRef.current = detector
        setMpStatus('ok')
        console.log('[Detection] Model ready. Starting loop.')

        // ── Per-frame detection + tracking loop ───────────────────────────
        const loop = () => {
          if (destroyed) return
          rafRef.current = requestAnimationFrame(loop)

          const video = videoRef.current
          if (!video || video.readyState < 2 || video.paused || video.videoWidth === 0) return

          // FPS
          fpsRef.current.n++
          const now = Date.now()
          if (now - fpsRef.current.last >= 1000) {
            setFps(fpsRef.current.n)
            fpsRef.current.n = 0
            fpsRef.current.last = now
          }

          // Raw detections from MediaPipe
          let rawDets = []
          try {
            const res = detector.detectForVideo(video, performance.now())
            // Convert pixel bboxes to % BEFORE passing to tracker
            rawDets = (res?.detections ?? []).map(d => {
              if (!d.boundingBox) return d
              const vW = video.videoWidth, vH = video.videoHeight
              const pct = tasksBoxToPercent(d.boundingBox, vW, vH)
              if (!pct) return d
              // Mirror X — video is CSS scaleX(-1)
              return {
                ...d,
                boundingBox: {
                  originX: pct.x,
                  originY: pct.y,
                  width:   pct.w,
                  height:  pct.h
                }
              }
            })
          } catch (_) { return }

          // Feed through tracking engine — gets smoothed box + state + motion
          const result = tracker.update(rawDets, video)

          setTrackState(result.state)
          setMotionLevel(result.motionEnergy)

          if (result.box && result.confidence > 0) {
            if (result.state === TrackState.TRACKING || result.state === TrackState.COASTING) {
              mergeRef.current('real', [{
                id:   'real-0',
                type: 'real',
                box:  { ...result.box },
                confidence:        result.confidence,
                displayConfidence: result.confidence,
                label:    'Person detected',
                trackState: result.state
              }])
            }
          } else {
            mergeRef.current('real', [])
          }
        }

        loop()

      } catch (err) {
        console.warn('[Detection] MediaPipe failed:', err.message)
        setMpStatus('fallback')
        mergeRef.current('real', [])
      }
    }

    initDetector()

    return () => {
      destroyed = true
      cancelAnimationFrame(rafRef.current)
      detectorRef.current?.close?.()
      detectorRef.current = null
      tracker.destroy()
      trackerRef.current = null
    }
  }, [status])

  if (status !== 'active') return null

  const recTime = `${String(Math.floor((recSeconds??0)/60)).padStart(2,'0')}:${String((recSeconds??0)%60).padStart(2,'0')}`

  const stateLabel  = STATE_LABELS[trackState] ?? 'SCANNING'
  const stateColor  = STATE_COLORS[trackState] ?? 'rgba(255,255,255,0.28)'
  const motionHigh  = motionLevel > 0.18

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.5 }}
      style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden' }}
    >
      {/* ── Video ──────────────────────────────────────────────────────────── */}
      <video ref={setVideoRef} autoPlay playsInline muted style={{
        position:'absolute', inset:0,
        width:'100%', height:'100%',
        objectFit:'cover', display:'block',
        transform:'scaleX(-1)', background:'#000'
      }} />

      {/* ── Chromatic aberration overlay (very subtle) ─────────────────────── */}
      <div style={{
        position:'absolute', inset:0, zIndex:8, pointerEvents:'none',
        background:'radial-gradient(ellipse 60% 50% at 15% 50%, rgba(255,0,0,0.012) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 85% 50%, rgba(0,100,255,0.008) 0%, transparent 70%)',
        mixBlendMode:'screen'
      }} />

      {/* ── Vignette ─────────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute', inset:0, zIndex:10, pointerEvents:'none',
        background:'radial-gradient(ellipse 86% 86% at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)'
      }} />

      {/* ── Film grain ───────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute', inset:0, zIndex:16, pointerEvents:'none', opacity:0.032,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize:'160px 160px'
      }} />

      {/* ── Scan sweep ───────────────────────────────────────────────────────── */}
      <div className="sweep-line" style={{ zIndex:15 }} />

      {/* ── Detection overlay ────────────────────────────────────────────────── */}
      <DetectionOverlay detections={allDetections} />

      {/* ── State banner (center-bottom of feed) ─────────────────────────────── */}
      <AnimatePresence>
        {trackState === TrackState.COASTING && (
          <motion.div
            key="coast"
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
            style={{
              position:'absolute', bottom:52, left:'50%', transform:'translateX(-50%)',
              zIndex:28, pointerEvents:'none',
              display:'flex', alignItems:'center', gap:7,
              padding:'4px 14px',
              background:'rgba(4,4,6,0.88)',
              border:'1px solid rgba(255,184,48,0.4)',
              borderRadius:2,
              backdropFilter:'blur(8px)',
            }}
          >
            <motion.div
              style={{ width:5, height:5, borderRadius:'50%', background:'#ffb830', flexShrink:0 }}
              animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.9, repeat:Infinity }}
            />
            <span style={{
              fontFamily:'IBM Plex Mono,monospace', fontSize:9,
              color:'rgba(255,184,48,0.8)', letterSpacing:'0.14em'
            }}>
              TRACKING LOST — HOLDING LAST KNOWN POSITION
            </span>
          </motion.div>
        )}

        {trackState === TrackState.ACQUIRING && motionHigh && (
          <motion.div
            key="motion"
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
            style={{
              position:'absolute', bottom:52, left:'50%', transform:'translateX(-50%)',
              zIndex:28, pointerEvents:'none',
              display:'flex', alignItems:'center', gap:7,
              padding:'4px 14px',
              background:'rgba(4,4,6,0.88)',
              border:'1px solid rgba(255,42,42,0.3)',
              borderRadius:2,
            }}
          >
            <motion.div
              style={{ width:5, height:5, borderRadius:'50%', background:'#ff2a2a', flexShrink:0 }}
              animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.7, repeat:Infinity }}
            />
            <span style={{
              fontFamily:'IBM Plex Mono,monospace', fontSize:9,
              color:'rgba(255,90,90,0.75)', letterSpacing:'0.14em'
            }}>
              MOTION DETECTED — ACQUIRING TARGET
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD: top-left ────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute', top:14, left:16, zIndex:30,
        fontFamily:'IBM Plex Mono,monospace', fontSize:10,
        color:'rgba(255,255,255,0.26)', letterSpacing:'0.07em',
        lineHeight:1.95, pointerEvents:'none'
      }}>
        <AnimatePresence mode="wait">
          {isRecording
            ? <motion.div key="rec"
                initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                style={{display:'flex',alignItems:'center',gap:6}}>
                <motion.div
                  style={{width:7,height:7,borderRadius:'50%',background:'#ff2020',
                    boxShadow:'0 0 7px #ff2020',flexShrink:0}}
                  animate={{opacity:[1,0.12,1]}} transition={{duration:0.85,repeat:Infinity}}
                />
                <span style={{color:'#ff5050',fontWeight:600}}>REC {recTime}</span>
              </motion.div>
            : <motion.div key="std"
                initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <span style={{color:'rgba(255,55,55,0.42)'}}>● STANDBY</span>
              </motion.div>
          }
        </AnimatePresence>
        <div style={{marginTop:2}}>{timestamp}</div>
        <div style={{color:'rgba(255,42,42,0.3)',marginTop:1}}>CAM-01 / PRESENCE</div>
      </div>

      {/* ── HUD: top-right ───────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute', top:14, right:16, zIndex:30,
        fontFamily:'IBM Plex Mono,monospace', fontSize:10,
        color:'rgba(255,255,255,0.24)', letterSpacing:'0.07em',
        lineHeight:1.95, textAlign:'right', pointerEvents:'none'
      }}>
        <div>DETECTIONS: {allDetections.length}</div>
        <div>FPS: {fps}</div>
        <div style={{ marginTop:2, color:stateColor }}>{stateLabel}</div>
        {mpStatus === 'loading'  && <div style={{color:'rgba(255,200,0,0.4)'}}>MODEL LOADING</div>}
        {mpStatus === 'fallback' && <div style={{color:'rgba(255,140,0,0.4)'}}>FALLBACK MODE</div>}
        {mpStatus === 'ok'       && <div style={{color:'rgba(0,220,100,0.35)'}}>AI ACTIVE</div>}
      </div>

      {/* ── Motion energy bar (subtle, top edge) ─────────────────────────────── */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:2,
        zIndex:29, pointerEvents:'none',
        background:'rgba(0,0,0,0.3)'
      }}>
        <motion.div style={{
          height:'100%',
          background:'linear-gradient(90deg, rgba(255,42,42,0.0) 0%, rgba(255,42,42,0.5) 100%)',
          width: `${Math.round(motionLevel * 100)}%`,
          transition:'width 0.2s ease'
        }} />
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:25,
        padding:'36px 18px 16px',
        background:'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        pointerEvents:'none'
      }}>
        <div style={{display:'flex',alignItems:'center',gap:7,
          fontFamily:'IBM Plex Mono,monospace',fontSize:10,
          color:'rgba(255,255,255,0.28)',letterSpacing:'0.1em'}}>
          <motion.div
            style={{width:6,height:6,borderRadius:'50%',background:'#ff2a2a',
              boxShadow:'0 0 8px rgba(255,42,42,0.9)',flexShrink:0}}
            animate={{opacity:[1,0.22,1]}}
            transition={{duration:1.5,repeat:Infinity}}
          />
          SCANNING
        </div>
        <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:10,
          color:'rgba(255,255,255,0.1)',letterSpacing:'0.07em'}}>
          PRESENCE DETECTOR v2.0
        </div>
      </div>
    </motion.div>
  )
}

// State → HUD label / color
const STATE_LABELS = {
  [TrackState.ACQUIRING]: 'ACQUIRING',
  [TrackState.TRACKING]:  '▸ TARGET LOCKED',
  [TrackState.COASTING]:  '◌ HOLDING',
  [TrackState.LOST]:      'SCAN ACTIVE',
}
const STATE_COLORS = {
  [TrackState.ACQUIRING]: 'rgba(255,255,255,0.22)',
  [TrackState.TRACKING]:  'rgba(0,232,122,0.7)',
  [TrackState.COASTING]:  'rgba(255,184,48,0.65)',
  [TrackState.LOST]:      'rgba(255,255,255,0.22)',
}
