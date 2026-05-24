import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion'
import { TrackState } from '../utils/TrackingEngine.js'

/**
 * DetectionOverlay
 *
 * Renders real + fake detection boxes.
 * Real boxes are state-aware:
 *   TRACKING  → green, solid, animated corners
 *   COASTING  → amber, dimmer, label shows decaying confidence
 *   LOST      → fades out smoothly
 *
 * z:20 — above vignette(10), grain(16), sweep(15), below HUD(25+)
 */
export function DetectionOverlay({ detections }) {
  return (
    <div style={{
      position:'absolute', inset:0,
      zIndex:20, pointerEvents:'none', overflow:'hidden'
    }}>
      <AnimatePresence>
        {detections.map(d => <Box key={d.id} det={d} />)}
      </AnimatePresence>
    </div>
  )
}

function Box({ det }) {
  const { box, type, confidence, displayConfidence, label, flickering, trackState } = det
  const conf    = Math.round(displayConfidence ?? confidence)
  const isReal  = type === 'real'
  const isCoast = trackState === TrackState.COASTING

  // Color scheme: tracking=green, coasting=amber, fake=red-orange
  const C = isReal
    ? isCoast
      ? { main:'#ffb830', glow:'rgba(255,184,48,0.12)', rim:'rgba(255,184,48,0.45)', pulse:false }
      : { main:'#00e87a', glow:'rgba(0,232,122,0.14)',  rim:'rgba(0,232,122,0.5)',  pulse:true  }
    : { main:'#ff5020', glow:'rgba(255,80,32,0.13)',  rim:'rgba(255,80,32,0.5)',  pulse:false }

  // Opacity: coast fades out as confidence decays
  const opacity = isCoast ? clamp((conf - 30) / 50, 0.15, 0.9) : 1.0
  // Label above or below depending on y position
  const labelTop = (box?.y ?? 0) < 14 ? 'calc(100% + 5px)' : -27

  if (!box) return null

  return (
    <motion.div
      style={{
        position:'absolute',
        left:  `${box.x}%`,
        top:   `${box.y}%`,
        width: `${box.w}%`,
        height:`${box.h}%`,
        opacity
      }}
      initial={{ opacity:0, scale:0.96 }}
      animate={{ opacity, scale:1 }}
      exit={{ opacity:0, scale:0.98 }}
      transition={{ duration: isReal ? 0.12 : 0.3, ease:'easeOut' }}
    >
      {/* ── Main border ── */}
      <div style={{
        position:'absolute', inset:0,
        border:`1px solid ${C.main}`,
        borderRadius:3,
        boxShadow:[
          `0 0 0 1px ${C.rim}`,
          `inset 0 0 20px ${C.glow}`,
          `0 0 28px ${C.glow}`,
          isReal && !isCoast ? `0 0 55px rgba(0,232,122,0.05)` : ''
        ].filter(Boolean).join(', ')
      }} />

      {/* ── Animated corner brackets ── */}
      <Corners color={C.main} animate={C.pulse} coasting={isCoast} />

      {/* ── Label ── */}
      <motion.div
        style={{
          position:'absolute',
          top: labelTop,
          left:-1,
          display:'flex', alignItems:'center', gap:6,
          padding:'2px 9px',
          background:'rgba(4,4,6,0.92)',
          border:`1px solid ${C.main}`,
          borderRadius:2,
          backdropFilter:'blur(10px)',
          WebkitBackdropFilter:'blur(10px)',
          whiteSpace:'nowrap',
        }}
        animate={flickering ? { opacity:[1,1,0.15,1,0.6,1] } : { opacity:1 }}
        transition={flickering ? { duration:1.4, repeat:Infinity, repeatDelay:3.5 } : {}}
      >
        <motion.div style={{
          width:5, height:5, borderRadius:'50%', flexShrink:0,
          background:C.main, boxShadow:`0 0 5px ${C.main}`
        }}
          animate={isReal && !isCoast ? { opacity:[1,0.35,1] } : { opacity:1 }}
          transition={isReal && !isCoast ? { duration:1.6, repeat:Infinity } : {}}
        />
        <span style={{
          fontFamily:'IBM Plex Mono,monospace', fontSize:10, fontWeight:500,
          color:C.main, letterSpacing:'0.1em', textTransform:'uppercase'
        }}>
          {isCoast ? 'Tracking…' : label}
        </span>
        <span style={{
          fontFamily:'IBM Plex Mono,monospace', fontSize:10,
          color:'rgba(255,255,255,0.3)', letterSpacing:'0.04em'
        }}>
          {conf}%
        </span>
      </motion.div>

      {/* ── Center crosshair ── */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        width:10, height:10, opacity:0.18
      }}>
        <div style={{position:'absolute',top:'50%',left:0,right:0,height:1,background:C.main}} />
        <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:C.main}} />
      </div>
    </motion.div>
  )
}

/** Animated corner brackets — pulse subtly while tracking */
function Corners({ color, animate, coasting }) {
  const corners = [
    { top:-1, left:-1,   bt:true,  bl:true  },
    { top:-1, right:-1,  bt:true,  br:true  },
    { bottom:-1, left:-1,  bb:true, bl:true },
    { bottom:-1, right:-1, bb:true, br:true },
  ]
  return (
    <>
      {corners.map((c, i) => (
        <motion.div key={i}
          className={animate ? 'corner-pulse' : ''}
          style={{
            position:'absolute',
            width:12, height:12,
            top:c.top, bottom:c.bottom, left:c.left, right:c.right,
            borderTopWidth:    c.bt ? 2 : 0,
            borderBottomWidth: c.bb ? 2 : 0,
            borderLeftWidth:   c.bl ? 2 : 0,
            borderRightWidth:  c.br ? 2 : 0,
            borderStyle:'solid', borderColor:color,
          }}
          animate={coasting ? { opacity:[0.8, 0.3, 0.8] } : { opacity:1 }}
          transition={coasting ? { duration:1.2, repeat:Infinity } : {}}
        />
      ))}
    </>
  )
}

function clamp(v,lo,hi) { return Math.max(lo, Math.min(hi, v)) }
