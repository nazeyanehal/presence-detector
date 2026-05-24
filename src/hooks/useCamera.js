import { useRef, useState, useCallback } from 'react'

export function useCamera() {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error,  setError]  = useState(null)

  // Stable attach function stored in ref so it reads streamRef at call-time
  const _attach = useRef((node) => {
    videoRef.current = node
    if (!node) return
    const stream = streamRef.current
    if (!stream) return
    node.srcObject = stream
    const play = () => node.play().catch(e => console.warn('[cam] play:', e.message))
    node.readyState >= 1 ? play() : node.addEventListener('loadedmetadata', play, { once: true })
  })

  const setVideoRef = useCallback((node) => _attach.current(node), [])

  const startCamera = useCallback(async () => {
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:1280}, height:{ideal:720}, facingMode:'user', frameRate:{ideal:30} },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current && !videoRef.current.srcObject) _attach.current(videoRef.current)
      setStatus('active')
    } catch (err) {
      setError(err.message || 'Camera access denied')
      setStatus('error')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  return { videoRef, setVideoRef, streamRef, status, error, startCamera, stopCamera }
}
