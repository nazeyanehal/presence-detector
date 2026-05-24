import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCamera }   from './hooks/useCamera.js'
import { useRecorder } from './hooks/useRecorder.js'
import { CameraFeed }  from './components/CameraFeed.jsx'
import { ParticleBackground } from './components/ParticleBackground.jsx'

export default function App() {
  const { videoRef, setVideoRef, streamRef, status, error, startCamera, stopCamera } = useCamera()
  const { isRecording, recSeconds, startRecording, stopRecording } = useRecorder(streamRef)
  const [appState, setAppState] = useState('landing')

  useEffect(() => {
    if (status === 'active')     setAppState('active')
    if (status === 'error')      setAppState('error')
    if (status === 'requesting') setAppState('loading')
    if (status === 'idle')       setAppState('landing')
  }, [status])

  useEffect(() => {
    if (status !== 'active' && isRecording) stopRecording()
  }, [status, isRecording, stopRecording])

  return (
    <div style={{
      width:'100vw', height:'100vh',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'#050507', overflow:'hidden', position:'relative'
    }}>
      <ParticleBackground />

      <AnimatePresence mode="wait">
        {appState === 'landing' && <LandingScreen key="land" onStart={startCamera} />}
        {appState === 'loading' && <LoadingScreen key="load" />}
        {appState === 'active'  && (
          <ActiveScreen key="active"
            videoRef={videoRef} setVideoRef={setVideoRef}
            onStop={stopCamera}
            isRecording={isRecording} recSeconds={recSeconds}
            onRecordToggle={isRecording ? stopRecording : startRecording}
          />
        )}
        {appState === 'error' && <ErrorScreen key="err" error={error} onRetry={startCamera} />}
      </AnimatePresence>
    </div>
  )
}

/* ─── Landing ──────────────────────────────────────────────────────────────── */
function LandingScreen({ onStart }) {
  const [hov, setHov] = useState(false)

  return (
    <motion.div
      initial={{ opacity:0, y:18 }}
      animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, y:-14 }}
      transition={{ duration:0.75, ease:[0.22,1,0.36,1] }}
      style={{
        position:'relative', zIndex:1,
        display:'flex', flexDirection:'column',
        alignItems:'center', textAlign:'center',
        padding:'0 32px', userSelect:'none'
      }}
    >
      {/* Radar icon */}
      <div style={{ position:'relative', width:104, height:104, marginBottom:52 }}>
        {[0,0.6,1.2].map((delay,i) => (
          <motion.div key={i} style={{
            position:'absolute',
            inset: i*14,
            borderRadius:'50%',
            border:`1px solid rgba(255,42,42,${0.1 + i*0.12})`
          }}
            animate={{ scale:[1, 1.05+i*0.02, 1], opacity:[0.45, 1, 0.45] }}
            transition={{ duration:2.8, repeat:Infinity, ease:'easeInOut', delay }}
          />
        ))}
        {/* Expanding pulse ring */}
        <div className="pulse-ring" style={{ inset:32 }} />
        {/* Core */}
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          width:14, height:14, borderRadius:'50%',
          background:'#ff2a2a',
          boxShadow:'0 0 18px #ff2a2a, 0 0 44px rgba(255,42,42,0.28)'
        }} />
      </div>

      <h1 style={{
        fontFamily:'Syne,sans-serif',
        fontSize:'clamp(30px,5vw,50px)',
        fontWeight:800,
        letterSpacing:'-0.03em',
        color:'#ebebeb',
        margin:'0 0 10px',
        lineHeight:1.05
      }}>
        Presence Detector
      </h1>

      <p style={{
        fontFamily:'IBM Plex Mono,monospace',
        fontSize:'clamp(9px,1.2vw,11px)',
        color:'rgba(235,235,235,0.22)',
        letterSpacing:'0.17em',
        textTransform:'uppercase',
        margin:'0 0 60px'
      }}>
        Neural spatial awareness system
      </p>

      {/* Vertical divider */}
      <div style={{
        width:1, height:52,
        background:'linear-gradient(to bottom, transparent, rgba(255,42,42,0.18), transparent)',
        marginBottom:54
      }} />

      {/* Feature list */}
      <div style={{
        display:'flex', flexDirection:'column', gap:12,
        marginBottom:56, alignItems:'flex-start'
      }}>
        {[
          ['Persistent neural face tracking',  '00e87a'],
          ['Motion-aware presence analysis',   'ffb830'],
          ['Spatial anomaly detection',         'ff5020'],
          ['Encrypted session recording',       '8888cc'],
        ].map(([text, col]) => (
          <div key={text} style={{
            display:'flex', alignItems:'center', gap:11,
            fontFamily:'IBM Plex Mono,monospace', fontSize:11,
            color:'rgba(235,235,235,0.28)', letterSpacing:'0.06em'
          }}>
            <div style={{
              width:3, height:3, borderRadius:'50%', flexShrink:0,
              background:`#${col}`, boxShadow:`0 0 5px #${col}`
            }} />
            {text}
          </div>
        ))}
      </div>

      {/* CTA */}
      <motion.button
        onClick={onStart}
        onHoverStart={() => setHov(true)}
        onHoverEnd={() => setHov(false)}
        whileTap={{ scale:0.97 }}
        style={{
          padding:'16px 54px',
          background: hov ? 'rgba(255,42,42,0.08)' : 'transparent',
          border:'1px solid',
          borderColor: hov ? 'rgba(255,42,42,0.6)' : 'rgba(255,255,255,0.1)',
          borderRadius:3,
          color: hov ? '#ff7070' : 'rgba(235,235,235,0.55)',
          fontFamily:'IBM Plex Mono,monospace',
          fontSize:13, fontWeight:500,
          letterSpacing:'0.18em', textTransform:'uppercase',
          cursor:'pointer',
          transition:'all 0.22s ease',
          boxShadow: hov
            ? '0 0 44px rgba(255,42,42,0.09), inset 0 0 32px rgba(255,42,42,0.04)'
            : 'none'
        }}
      >
        Begin Session
      </motion.button>

      <p style={{
        marginTop:22,
        fontFamily:'IBM Plex Mono,monospace', fontSize:10,
        color:'rgba(235,235,235,0.13)', letterSpacing:'0.07em'
      }}>
        Camera permission required
      </p>

      {/* Corner decorations */}
      <Corners />
    </motion.div>
  )
}

/* ─── Loading ──────────────────────────────────────────────────────────────── */
function LoadingScreen() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN(x => (x+1)%4), 300)
    return () => clearInterval(t)
  }, [])
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{ position:'relative', zIndex:1, textAlign:'center' }}>
      <div style={{
        fontFamily:'IBM Plex Mono,monospace', fontSize:11,
        color:'rgba(235,235,235,0.28)', letterSpacing:'0.14em', textTransform:'uppercase'
      }}>
        Initializing{'.'.repeat(n)}
      </div>
    </motion.div>
  )
}

/* ─── Active ───────────────────────────────────────────────────────────────── */
function ActiveScreen({ videoRef, setVideoRef, onStop, isRecording, recSeconds, onRecordToggle }) {
  const [rHov, setRHov] = useState(false)
  const [eHov, setEHov] = useState(false)

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      transition={{ duration:0.4 }}
      style={{
        position:'relative', zIndex:1,
        width:'100%', height:'100%',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'18px 22px'
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        width:'100%', maxWidth:940, marginBottom:13
      }}>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <motion.div
            style={{width:7,height:7,borderRadius:'50%',background:'#ff2a2a',
              boxShadow:'0 0 8px rgba(255,42,42,0.9)',flexShrink:0}}
            animate={{opacity:[1,0.22,1]}}
            transition={{duration:1.4,repeat:Infinity}}
          />
          <span style={{
            fontFamily:'Syne,sans-serif', fontSize:13, fontWeight:700,
            letterSpacing:'0.08em', color:'rgba(235,235,235,0.65)', textTransform:'uppercase'
          }}>
            Presence Detector
          </span>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* Record */}
          <motion.button
            onClick={onRecordToggle}
            onHoverStart={() => setRHov(true)}
            onHoverEnd={() => setRHov(false)}
            whileTap={{ scale:0.95 }}
            style={{
              display:'flex', alignItems:'center', gap:7, padding:'6px 16px',
              background: isRecording ? 'rgba(255,32,32,0.09)' : rHov ? 'rgba(255,42,42,0.05)' : 'transparent',
              border:'1px solid',
              borderColor: isRecording ? 'rgba(255,42,42,0.6)' : rHov ? 'rgba(255,42,42,0.28)' : 'rgba(255,255,255,0.08)',
              borderRadius:2, cursor:'pointer', transition:'all 0.2s ease',
              boxShadow: isRecording ? '0 0 22px rgba(255,42,42,0.1)' : 'none'
            }}
          >
            <motion.div
              style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
                background: isRecording ? '#ff2020' : 'rgba(255,42,42,0.4)',
                boxShadow: isRecording ? '0 0 6px #ff2020' : 'none'
              }}
              animate={isRecording ? {opacity:[1,0.12,1]} : {opacity:1}}
              transition={isRecording ? {duration:0.88,repeat:Infinity} : {}}
            />
            <span style={{
              fontFamily:'IBM Plex Mono,monospace', fontSize:10,
              color: isRecording ? '#ff5555' : 'rgba(235,235,235,0.25)',
              letterSpacing:'0.1em', textTransform:'uppercase'
            }}>
              {isRecording ? 'Stop' : 'Record'}
            </span>
          </motion.button>

          {/* End */}
          <button
            onClick={onStop}
            onMouseEnter={() => setEHov(true)}
            onMouseLeave={() => setEHov(false)}
            style={{
              padding:'6px 16px', background:'transparent',
              border:'1px solid',
              borderColor: eHov ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
              borderRadius:2, cursor:'pointer',
              fontFamily:'IBM Plex Mono,monospace', fontSize:10,
              color:'rgba(235,235,235,0.18)', letterSpacing:'0.1em',
              textTransform:'uppercase', transition:'all 0.2s ease'
            }}
          >
            End
          </button>
        </div>
      </div>

      {/* ── Viewport ─────────────────────────────────────────────────────────── */}
      <div style={{
        position:'relative', width:'100%', maxWidth:940,
        aspectRatio:'16/9', borderRadius:7, overflow:'hidden', background:'#000',
        boxShadow:[
          '0 0 0 1px rgba(255,255,255,0.04)',
          isRecording
            ? '0 0 0 2px rgba(255,42,42,0.38), 0 0 80px rgba(255,42,42,0.07)'
            : '0 0 0 1px rgba(255,42,42,0.05)',
          '0 28px 64px rgba(0,0,0,0.8)',
          '0 0 130px rgba(0,0,0,0.45)'
        ].join(', '),
        transition:'box-shadow 0.45s ease'
      }}>
        <CameraFeed
          videoRef={videoRef} setVideoRef={setVideoRef}
          status="active"
          isRecording={isRecording} recSeconds={recSeconds}
        />

        {/* Recording border pulse */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{opacity:0}} exit={{opacity:0}}
              animate={{opacity:[0,0.45,0]}}
              transition={{duration:2.2,repeat:Infinity}}
              style={{
                position:'absolute', inset:0,
                border:'2px solid rgba(255,42,42,0.4)',
                borderRadius:7, pointerEvents:'none', zIndex:55
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        width:'100%', maxWidth:940, marginTop:13
      }}>
        <div style={{display:'flex',alignItems:'center',gap:7,
          fontFamily:'IBM Plex Mono,monospace',fontSize:10,
          color:'rgba(235,235,235,0.16)',letterSpacing:'0.09em',textTransform:'uppercase'}}>
          <motion.div
            style={{width:5,height:5,borderRadius:'50%',background:'#00e87a',
              boxShadow:'0 0 5px rgba(0,232,122,0.75)',flexShrink:0}}
            animate={{opacity:[1,0.32,1]}}
            transition={{duration:2.3,repeat:Infinity}}
          />
          Live analysis active
        </div>
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:10}}
              style={{
                fontFamily:'IBM Plex Mono,monospace',fontSize:10,
                color:'rgba(255,80,80,0.45)',letterSpacing:'0.07em'
              }}
            >
              Auto-download on stop
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ─── Error ────────────────────────────────────────────────────────────────── */
function ErrorScreen({ error, onRetry }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{ position:'relative', zIndex:1, textAlign:'center', padding:32 }}>
      <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,
        color:'rgba(255,42,42,0.72)',marginBottom:14}}>
        Camera Unavailable
      </div>
      <div style={{fontFamily:'IBM Plex Mono,monospace',fontSize:11,
        color:'rgba(235,235,235,0.26)',marginBottom:36,maxWidth:340,lineHeight:1.8}}>
        {error || 'Camera access denied. Grant permission and retry.'}
      </div>
      <button onClick={onRetry} style={{
        fontFamily:'IBM Plex Mono,monospace',fontSize:11,
        color:'rgba(235,235,235,0.38)',background:'none',
        border:'1px solid rgba(255,255,255,0.09)',borderRadius:2,
        padding:'9px 24px',cursor:'pointer',
        letterSpacing:'0.1em',textTransform:'uppercase'
      }}>
        Retry
      </button>
    </motion.div>
  )
}

/* ─── Corner decorations ───────────────────────────────────────────────────── */
function Corners() {
  const c = 'rgba(255,42,42,0.09)'
  const s = { position:'fixed', width:22, height:22 }
  return (
    <>
      <div style={{...s,top:22,left:22,   borderTop:`1px solid ${c}`,borderLeft:`1px solid ${c}`}} />
      <div style={{...s,top:22,right:22,  borderTop:`1px solid ${c}`,borderRight:`1px solid ${c}`}} />
      <div style={{...s,bottom:22,left:22,  borderBottom:`1px solid ${c}`,borderLeft:`1px solid ${c}`}} />
      <div style={{...s,bottom:22,right:22, borderBottom:`1px solid ${c}`,borderRight:`1px solid ${c}`}} />
    </>
  )
}
