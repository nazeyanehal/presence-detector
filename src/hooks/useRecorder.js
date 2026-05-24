import { useRef, useState, useCallback } from 'react'

export function useRecorder(streamRef) {
  const recRef    = useRef(null)
  const chunksRef = useRef([])
  const timerRef  = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recSeconds,  setRecSeconds]  = useState(0)

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4']
      .find(t => MediaRecorder.isTypeSupported(t)) || ''
    chunksRef.current = []
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
    rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' })
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), {
        href: url, download: `presence-${Date.now()}.${mime.includes('mp4')?'mp4':'webm'}`
      })
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
    rec.start(200)
    recRef.current = rec
    setIsRecording(true); setRecSeconds(0)
    timerRef.current = setInterval(() => setRecSeconds(s => s+1), 1000)
  }, [streamRef])

  const stopRecording = useCallback(() => {
    if (recRef.current?.state !== 'inactive') recRef.current?.stop()
    recRef.current = null
    clearInterval(timerRef.current)
    setIsRecording(false); setRecSeconds(0)
  }, [])

  return { isRecording, recSeconds, startRecording, stopRecording }
}
