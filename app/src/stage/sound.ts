/** Stage audio: spin loop, fanfare, and a synthesized split-flap tick. All respect one mute flag. */

const MUTE_KEY = 'ys60.stage.muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

class StageSound {
  muted = readMuted()
  private spin?: HTMLAudioElement
  private fanfare?: HTMLAudioElement
  private ctx?: AudioContext
  private lastTick = 0

  private load() {
    if (this.spin) return
    this.spin = new Audio('/sounds/slot-machine.mp3')
    this.spin.loop = true
    this.spin.volume = 0.6
    this.fanfare = new Audio('/sounds/fanfare-sound.mp3')
    this.fanfare.volume = 0.9
  }

  setMuted(muted: boolean) {
    this.muted = muted
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      /* private mode: keep in memory only */
    }
    if (muted) this.stopAll()
  }

  startSpin() {
    if (this.muted) return
    this.load()
    this.spin!.currentTime = 0
    void this.spin!.play().catch(() => {})
  }

  stopSpin() {
    this.spin?.pause()
  }

  playFanfare() {
    this.stopSpin()
    if (this.muted) return
    this.load()
    this.fanfare!.currentTime = 0
    void this.fanfare!.play().catch(() => {})
  }

  /** Short mechanical click (split-flap). Rate-limited so dozens of flaps don't become noise. */
  tick() {
    if (this.muted) return
    const now = performance.now()
    if (now - this.lastTick < 28) return
    this.lastTick = now
    this.ctx ??= new AudioContext()
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * 0.012)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2400
    const gain = ctx.createGain()
    gain.gain.value = 0.35
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
  }

  stopAll() {
    this.spin?.pause()
    this.fanfare?.pause()
  }
}

export const stageSound = new StageSound()
