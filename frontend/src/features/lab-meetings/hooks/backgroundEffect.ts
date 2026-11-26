/**
 * Background blur / replacement for the camera. Runs on this computer: a MediaPipe person-segmentation model finds
 * the person in each frame, then the canvas draws the person over a blurred copy of the room, a picture or a colour.
 * The result is a new video track that replaces the camera in the call. Nothing is sent to any server.
 *
 * The segmentation code and model are loaded only when someone turns an effect on, and are served from this site
 * (/mediapipe/selfie_segmenter.tflite), so the page's security policy needs no outside hosts.
 */
import wasmLoaderUrl from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryUrl from '../../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'

export type BgMode = { kind: 'none' } | { kind: 'blur'; amount: number } | { kind: 'image'; src: string }

const MODEL_URL = '/mediapipe/selfie_segmenter.tflite'
const FPS = 24

interface Segmenter { segmentForVideo(v: HTMLVideoElement, ts: number, cb: (r: { confidenceMasks?: { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }[] }) => void): void; close(): void }
let segmenterPromise: Promise<Segmenter> | null = null

async function loadSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const head = await fetch(MODEL_URL, { method: 'HEAD' }).catch(() => null)
      if (!head?.ok) throw new Error('The background model file is missing (public/mediapipe/selfie_segmenter.tflite).')
      const { ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const fileset = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }
      const opts = (delegate: 'GPU' | 'CPU') => ({ baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO' as const, outputConfidenceMasks: true, outputCategoryMask: false })
      try { return (await ImageSegmenter.createFromOptions(fileset, opts('GPU'))) as unknown as Segmenter }
      catch { return (await ImageSegmenter.createFromOptions(fileset, opts('CPU'))) as unknown as Segmenter }
    })().catch((e) => { segmenterPromise = null; throw e })
  }
  return segmenterPromise
}

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('That image could not be read.')); i.src = src })

export class BackgroundProcessor {
  private video = document.createElement('video')
  private out = document.createElement('canvas')
  private person = document.createElement('canvas')
  private mask = document.createElement('canvas')
  private timer: number | undefined
  private image: HTMLImageElement | null = null
  private seg: Segmenter | null = null
  private busy = false

  constructor(source: MediaStreamTrack, private mode: Exclude<BgMode, { kind: 'none' }>) {
    this.video.muted = true; this.video.playsInline = true
    this.video.srcObject = new MediaStream([source])
  }

  /** Starts the effect and returns the new video track to send. */
  async start(): Promise<MediaStreamTrack> {
    const [seg, image] = await Promise.all([loadSegmenter(), this.mode.kind === 'image' ? loadImage(this.mode.src) : Promise.resolve(null)])
    this.seg = seg; this.image = image
    await this.video.play()
    await new Promise<void>((ok) => { if (this.video.videoWidth) ok(); else this.video.onloadedmetadata = () => ok() })
    const w = this.video.videoWidth
    const h = this.video.videoHeight
    for (const c of [this.out, this.person]) { c.width = w; c.height = h }
    this.timer = window.setInterval(() => this.frame(), 1000 / FPS)
    this.frame()
    return this.out.captureStream(FPS).getVideoTracks()[0]
  }

  private frame(): void {
    if (this.busy || !this.seg || this.video.readyState < 2) return
    this.busy = true
    try {
      this.seg.segmentForVideo(this.video, performance.now(), (r) => {
        const m = r.confidenceMasks?.[0]
        if (m) this.compose(m.getAsFloat32Array(), m.width, m.height)
        m?.close()
      })
    } catch { /* skip a frame that fails */ } finally { this.busy = false }
  }

  private compose(conf: Float32Array, mw: number, mh: number): void {
    const { out, person, mask, video } = this
    const g = out.getContext('2d')!
    // The background: a blurred copy of the camera, or a picture covering the frame.
    if (this.mode.kind === 'blur') {
      g.filter = `blur(${this.mode.amount}px)`
      g.drawImage(video, -this.mode.amount * 2, -this.mode.amount * 2, out.width + this.mode.amount * 4, out.height + this.mode.amount * 4)
      g.filter = 'none'
    } else if (this.image) {
      const s = Math.max(out.width / this.image.width, out.height / this.image.height)
      const dw = this.image.width * s
      const dh = this.image.height * s
      g.drawImage(this.image, (out.width - dw) / 2, (out.height - dh) / 2, dw, dh)
    }
    // The person: the camera picture cut out with the mask (soft edges come from scaling the mask up).
    if (mask.width !== mw || mask.height !== mh) { mask.width = mw; mask.height = mh; }
    const mg = mask.getContext('2d')!
    const img = mg.createImageData(mw, mh)
    for (let i = 0; i < conf.length; i++) { const o = i * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, Math.max(0, (conf[i] - 0.25) * 340)) }
    mg.putImageData(img, 0, 0)
    const pg = person.getContext('2d')!
    pg.globalCompositeOperation = 'source-over'
    pg.clearRect(0, 0, person.width, person.height)
    pg.drawImage(video, 0, 0, person.width, person.height)
    pg.globalCompositeOperation = 'destination-in'
    pg.drawImage(mask, 0, 0, person.width, person.height)
    g.drawImage(person, 0, 0)
  }

  stop(): void {
    window.clearInterval(this.timer)
    this.video.srcObject = null
    // The segmenter is shared and kept for the next effect; the output track is stopped by whoever owns it.
  }
}
