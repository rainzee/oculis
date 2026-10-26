// 全部声音由 Web Audio 合成, 没有音频文件

const CHIMES = [392, 440, 523.25, 587.33, 659.25, 783.99]
const CHORD = [261.63, 329.63, 392, 493.88]

/** 失真曲线, k 越大越脏 */
function distortion(k) {
  const n = 44100
  const curve = new Float32Array(n)
  const deg = Math.PI / 180
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
  }
  return curve
}

/** 生成混响用的衰减噪声脉冲 */
function impulse(ctx, seconds, decay = 2.4) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
  }
  return buffer
}

/** 创建页面音频, 必须在用户手势中调用一次 start, 除 speed 与 setMuted 外的方法只在 start 之后调用 */
export function createAudio() {
  let ctx = null
  let master = null
  let reverb = null
  let drone = null
  let scrub = null
  let muted = false

  function start() {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.8
    master.connect(ctx.destination)

    const convolver = ctx.createConvolver()
    convolver.buffer = impulse(ctx, 3.2)
    reverb = ctx.createGain()
    reverb.gain.value = 0.4
    reverb.connect(convolver)
    convolver.connect(master)

    // 低频持续音, 频率跟随眼睛的速度
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 420
    const droneGain = ctx.createGain()
    droneGain.gain.setValueAtTime(0, ctx.currentTime)
    droneGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 3)
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    a.frequency.value = 55
    b.frequency.value = 55.4
    b.type = 'triangle'
    a.connect(low)
    b.connect(low)
    low.connect(droneGain)
    droneGain.connect(master)
    a.start()
    b.start()
    drone = { a, b }

    // 滚动时的沙沙声, 增益跟随滚动速度
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1400
    band.Q.value = 0.7
    scrub = ctx.createGain()
    scrub.gain.value = 0
    source.connect(band)
    band.connect(scrub)
    scrub.connect(master)
    source.start()
  }

  /** 眼睛速度映射为持续音的音高 */
  function speed(value) {
    if (!drone) return
    const f = 48 + Math.min(value, 1) * 320
    drone.a.frequency.setTargetAtTime(f, ctx.currentTime, 0.08)
    drone.b.frequency.setTargetAtTime(f * 1.007, ctx.currentTime, 0.08)
  }

  /** 滚动速度映射为噪声音量 */
  function scroll(delta) {
    scrub.gain.cancelScheduledValues(ctx.currentTime)
    scrub.gain.setTargetAtTime(Math.min(0.09, Math.abs(delta) * 1.4), ctx.currentTime, 0.03)
    scrub.gain.setTargetAtTime(0, ctx.currentTime + 0.12, 0.12)
  }

  /** 眼睛撞墙时的失真弹响 */
  function boing() {
    const now = ctx.currentTime
    const saw = ctx.createOscillator()
    const ring = ctx.createOscillator()
    const ringGain = ctx.createGain()
    const shaperA = ctx.createWaveShaper()
    const shaperB = ctx.createWaveShaper()
    const filter = ctx.createBiquadFilter()
    const out = ctx.createGain()
    shaperA.curve = distortion(800)
    shaperA.oversample = '4x'
    shaperB.curve = distortion(400)
    shaperB.oversample = '2x'
    filter.type = 'lowpass'
    filter.frequency.value = 300
    filter.Q.value = 10
    saw.type = 'sawtooth'
    saw.frequency.setValueAtTime(3, now)
    saw.frequency.exponentialRampToValueAtTime(330, now + 0.3)
    ring.type = 'square'
    ring.frequency.value = 1200
    ringGain.gain.value = 0.3
    out.gain.setValueAtTime(0.22, now)
    out.gain.exponentialRampToValueAtTime(0.002, now + 0.2)
    saw.connect(shaperA)
    ring.connect(ringGain)
    ringGain.connect(shaperA)
    shaperA.connect(shaperB)
    shaperB.connect(filter)
    filter.connect(out)
    out.connect(master)
    saw.start(now)
    ring.start(now)
    saw.stop(now + 0.4)
    ring.stop(now + 0.2)
  }

  /** 章节切换时的短音 */
  function chime(index) {
    const now = ctx.currentTime
    const f = CHIMES[index % CHIMES.length]
    for (const [type, mult, level] of [
      ['sine', 1, 0.12],
      ['triangle', 2, 0.04],
    ]) {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = type
      osc.frequency.value = f * mult
      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(level, now + 0.006)
      env.gain.exponentialRampToValueAtTime(0.0005, now + 1.4)
      osc.connect(env)
      env.connect(master)
      env.connect(reverb)
      osc.start(now)
      osc.stop(now + 1.5)
    }
  }

  /** 字标成形时的和弦 */
  function chord() {
    const now = ctx.currentTime
    CHORD.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.frequency.value = f
      env.gain.setValueAtTime(0, now)
      env.gain.linearRampToValueAtTime(0.05, now + 0.4 + i * 0.08)
      env.gain.exponentialRampToValueAtTime(0.0005, now + 5)
      osc.connect(env)
      env.connect(master)
      env.connect(reverb)
      osc.start(now)
      osc.stop(now + 5.2)
    })
  }

  function setMuted(value) {
    muted = value
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05)
  }

  return {
    start,
    speed,
    scroll,
    boing,
    chime,
    chord,
    setMuted,
    get muted() {
      return muted
    },
  }
}
