import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Gulungan in true 3D: a lit drum lying on its side with names printed on curved panels.
 * World units are stage pixels (the stage is a fixed 1920Ã—1080 canvas), camera centred on it.
 * Only the panels' text textures change; each panel is repainted only while it is on the hidden back.
 */

export const SLOTS = 18
export const SLOT = (Math.PI * 2) / SLOTS
export const ROW_H = 104
export const RADIUS = ROW_H / SLOT
const DRUM_W = 1300
const DRUM_Y = -60 // stage y 600 (world y is up, origin at the stage centre 540)
const FOV = 28
const TEX_W = 1024
const TEX_H = 128

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif'

export interface DrumScene {
  canvas: HTMLCanvasElement
  /** Rotate the drum so that row `pos` (fractional) faces the viewer. */
  setPosition(pos: number): void
  /** Name shown on a row index (called when a panel needs repainting). */
  setNameFor(fn: (row: number) => string): void
  /** Highlight a row (the winner) in gold; null clears. */
  setHighlight(row: number | null): void
  /** 0 = normal, 1 = rows dimmed for the reveal. */
  setDim(k: number): void
  /** Reveal flash: 0 = off, rises to 1 and fades as k goes 0 â†’ 1. */
  setFlash(k: number): void
  repaintAll(): void
  resize(pixelScale: number): void
  render(): void
  dispose(): void
}

interface Panel {
  mesh: THREE.Mesh
  ctx: CanvasRenderingContext2D
  tex: THREE.CanvasTexture
  mat: THREE.MeshBasicMaterial
  row: number
  text: string
  gold: boolean
}

/** A flat strip bent onto the drum surface, centred on angle 0 (facing +z). */
function curvedStrip(width: number, height: number, radius: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, height, 1, 10)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const a = y / radius
    p.setXYZ(i, p.getX(i), Math.sin(a) * radius, Math.cos(a) * radius)
  }
  g.computeVertexNormals()
  return g
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  x.fillStyle = g
  x.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createDrumScene(): DrumScene {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const canvas = renderer.domElement

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env
  const key = new THREE.DirectionalLight('#ffffff', 1.4)
  key.position.set(-0.4, 1, 0.9)
  scene.add(key)

  const camera = new THREE.PerspectiveCamera(FOV, 1920 / 1080, 10, 20000)
  camera.position.set(0, 0, 540 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)))

  const rig = new THREE.Group()
  rig.position.y = DRUM_Y
  scene.add(rig)
  const drum = new THREE.Group()
  rig.add(drum)

  // Barrel: dark Sabah-blue enamel with gold end rings.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIUS - 3, RADIUS - 3, DRUM_W, 96, 1, true).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#0f2a4d', metalness: 0.45, roughness: 0.42 }),
  )
  drum.add(body)
  const bodyColor = (body.material as THREE.MeshStandardMaterial).color.clone()
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b45c', metalness: 0.95, roughness: 0.25 })
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RADIUS + 2, 9, 16, 96), gold)
    ring.rotation.y = Math.PI / 2
    ring.position.x = side * (DRUM_W / 2 + 4)
    drum.add(ring)
    for (let k = 0; k < SLOTS; k++) {
      // Rivets on the rings mark each row, so the drum's turning reads even at speed.
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8), gold)
      const a = k * SLOT + SLOT / 2
      rivet.position.set(side * (DRUM_W / 2 + 4), Math.sin(a) * (RADIUS + 12), Math.cos(a) * (RADIUS + 12))
      drum.add(rivet)
    }
  }

  // Name panels: one per slot, each with its own small text texture.
  const strip = curvedStrip(DRUM_W - 60, ROW_H - 8, RADIUS + 1)
  const panels: Panel[] = Array.from({ length: SLOTS }, (_, k) => {
    const c = document.createElement('canvas')
    c.width = TEX_W
    c.height = TEX_H
    const ctx = c.getContext('2d')!
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    // Unlit text (cheap to draw); the barrel underneath carries the lighting.
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
    const mesh = new THREE.Mesh(strip, mat)
    mesh.rotation.x = -k * SLOT
    drum.add(mesh)
    return { mesh, ctx, tex, mat, row: Number.NaN, text: '', gold: false }
  })

  // Gold paylines in front of the drum.
  const lineGeo = new THREE.BoxGeometry(DRUM_W + 120, 5, 5)
  const lineMat = new THREE.MeshStandardMaterial({ color: '#e0b45c', metalness: 0.95, roughness: 0.25, transparent: true })
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(lineGeo, lineMat)
    line.position.set(0, side * (ROW_H / 2 + 6), RADIUS + 26)
    rig.add(line)
  }

  // Reveal flash: an additive glow plus a ring of rays.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,236,190,1)', 'rgba(224,180,92,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
  )
  flash.position.z = RADIUS + 40
  rig.add(flash)
  const rays = new THREE.Group()
  const rayMat = new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })
  for (let i = 0; i < 24; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(10, 900), rayMat)
    ray.rotation.z = (i / 24) * Math.PI * 2
    ray.geometry.translate(0, 520, 0)
    rays.add(ray)
  }
  rays.position.z = RADIUS + 35
  rig.add(rays)

  let nameFor: (row: number) => string = () => ''
  let highlight: number | null = null
  let pos = 0

  const paint = (p: Panel, text: string, isGold: boolean) => {
    const { ctx } = p
    ctx.clearRect(0, 0, TEX_W, TEX_H)
    let size = 92
    ctx.font = `700 ${size}px ${FONT}`
    while (ctx.measureText(text).width > TEX_W - 40 && size > 40) {
      size -= 4
      ctx.font = `700 ${size}px ${FONT}`
    }
    ctx.fillStyle = isGold ? '#e0b45c' : '#f3f8fc'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, TEX_W / 2, TEX_H / 2 + 4)
    p.tex.needsUpdate = true
    p.text = text
    p.gold = isGold
  }

  /** Which row each panel should show: the one of its kind nearest the front. */
  const sync = (force = false) => {
    for (let k = 0; k < SLOTS; k++) {
      const p = panels[k]
      const row = k + SLOTS * Math.round((pos - k) / SLOTS)
      const isGold = highlight !== null && row === highlight
      if (force || row !== p.row || isGold !== p.gold) {
        p.row = row
        const text = nameFor(row)
        if (force || text !== p.text || isGold !== p.gold) paint(p, text, isGold)
      }
    }
  }

  return {
    canvas,
    setPosition(v) {
      pos = v
      drum.rotation.x = pos * SLOT
      sync()
    },
    setNameFor(fn) {
      nameFor = fn
    },
    setHighlight(row) {
      highlight = row
      sync()
    },
    setDim(k) {
      // Reveal: the names fade, the drum recedes and darkens, the paylines fade.
      for (const p of panels) p.mat.opacity = 1 - k
      lineMat.opacity = 1 - k
      drum.position.z = -k * 260
      ;(body.material as THREE.MeshStandardMaterial).color.copy(bodyColor).multiplyScalar(1 - k * 0.7)
    },
    setFlash(k) {
      const a = k <= 0 || k >= 1 ? 0 : Math.sin(k * Math.PI)
      ;(flash.material as THREE.MeshBasicMaterial).opacity = a
      const s = 300 + k * 1500
      flash.scale.set(s * 1.6, s, 1)
      rayMat.opacity = a * 0.35
      rays.rotation.z = k * 0.6
      rays.scale.setScalar(0.6 + k * 0.9)
    },
    repaintAll() {
      sync(true)
    },
    resize(pixelScale) {
      renderer.setPixelRatio(1)
      renderer.setSize(Math.round(1920 * pixelScale), Math.round(1080 * pixelScale), false)
    },
    render() {
      renderer.render(scene, camera)
    },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material as THREE.MeshStandardMaterial
          m.map?.dispose()
          m.dispose()
        }
      })
      env.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
