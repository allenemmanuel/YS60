import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * A 3D "60" built from blocks, discs and gears, plus the formations the parts move between.
 * Units: one grid cell = 1. The digits are 5×7 cells each, one empty column apart.
 */

const SIX = ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.']
const ZERO = ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.']

export const RAINBOW = ['#ff4b4b', '#ff7d36', '#f9c440', '#b8ff57', '#3ee88f', '#3ee8c0', '#22d3ee', '#5b8cff']

/** Deterministic random so formations are the same every load. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gearGeometry(r: number, teeth: number, depth: number) {
  const s = new THREE.Shape()
  const steps = teeth * 4
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const rr = i % 4 < 2 ? r : r * 0.8
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  const hole = new THREE.Path()
  hole.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true)
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: r * 0.03, bevelSegments: 2 })
  g.translate(0, 0, -depth / 2)
  return g
}

export interface Pose {
  p: THREE.Vector3
  r: THREE.Vector3 // Euler angles (rad)
  s: number
}

export type FormationName = 'scatter' | 'home' | 'exploded' | 'ring' | 'kit' | 'heart'

export interface Sixty {
  root: THREE.Group
  /** Turned by the timeline during the feature chapters (a full turn = back to identity). */
  swirl: THREE.Group
  parts: THREE.Mesh[]
  gears: THREE.Mesh[]
  formations: Record<FormationName, Pose[]>
  /** Indices of the parts the toolbox labels point at (11, in label order). */
  labelled: number[]
}

export function buildSixty(): Sixty {
  const root = new THREE.Group()
  const swirl = new THREE.Group()
  root.add(swirl)
  const rand = rng(60)

  const cells: { x: number; y: number }[] = []
  const addDigit = (rows: string[], offsetX: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === '#') cells.push({ x: offsetX + i, y: 3 - j })
      }),
    )
  addDigit(SIX, -5.5)
  addDigit(ZERO, 0.5)

  const block = new RoundedBoxGeometry(0.92, 0.92, 0.92, 2, 0.14)
  const disc = new THREE.CylinderGeometry(0.46, 0.46, 0.92, 24).rotateX(Math.PI / 2)
  const gear = gearGeometry(0.95, 14, 0.32)
  const smallGear = gearGeometry(0.62, 10, 0.3)

  const materials = RAINBOW.map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.35, roughness: 0.32 }))
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b45c', metalness: 0.95, roughness: 0.22 })
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.9, roughness: 0.28 })

  const parts: THREE.Mesh[] = []
  const homes: Pose[] = []
  cells.forEach((c) => {
    // Mostly rounded blocks, with a scatter of discs for variety; colour runs across the digits.
    const geo = (c.x * 7 + c.y * 3) % 5 === 0 ? disc : block
    const colour = Math.floor(((c.x + 5.5) / 11.5) * RAINBOW.length) % RAINBOW.length
    const m = new THREE.Mesh(geo, materials[colour])
    parts.push(m)
    homes.push({ p: new THREE.Vector3(c.x, c.y, 0), r: new THREE.Vector3(0, 0, 0), s: 1 })
  })

  // Gears sit inside the loops of the 6 and the 0, behind the blocks.
  const gearSpots: [number, number, number, THREE.BufferGeometry, THREE.Material][] = [
    [-3.5, -1.5, -0.8, gear, gold],
    [2.5, 0, -0.8, gear, gold],
    [-2.2, -0.3, -1.3, smallGear, steel],
    [3.8, 1.6, -1.3, smallGear, steel],
  ]
  const gears = gearSpots.map(([x, y, z, g, mat]) => {
    const m = new THREE.Mesh(g, mat)
    parts.push(m)
    homes.push({ p: new THREE.Vector3(x, y, z), r: new THREE.Vector3(0, 0, 0), s: 1 })
    return m
  })

  parts.forEach((m) => swirl.add(m))
  const n = parts.length

  // --- formations ---
  const scatter: Pose[] = parts.map(() => {
    const a = rand() * Math.PI * 2
    const e = (rand() - 0.5) * 1.6
    const rad = 7 + rand() * 6
    return {
      p: new THREE.Vector3(Math.cos(a) * Math.cos(e) * rad * 1.3, Math.sin(e) * rad * 0.8, -4 - rand() * 10),
      r: new THREE.Vector3((rand() - 0.5) * 6, (rand() - 0.5) * 6, (rand() - 0.5) * 6),
      s: 0.55,
    }
  })
  const exploded: Pose[] = homes.map((h, i) => {
    const layer = (i * 7) % 5
    const isGear = i >= n - gears.length
    return {
      p: new THREE.Vector3(h.p.x * 1.28, h.p.y * 1.28, isGear ? -6 : (layer - 2) * 2.0),
      r: new THREE.Vector3((rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9, isGear ? Math.PI : (rand() - 0.5) * 0.9),
      s: isGear ? 1.15 : 0.9,
    }
  })
  const ring: Pose[] = parts.map((_, i) => {
    const a = (i / n) * Math.PI * 2
    const rad = 6.4 + (i % 2) * 0.6
    return { p: new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, -3 - (i % 3) * 0.6), r: new THREE.Vector3(0.6, 0.4, a), s: 0.42 }
  })
  const kit: Pose[] = parts.map((_, i) => {
    const cols = 10
    return { p: new THREE.Vector3(((i % cols) - (cols - 1) / 2) * 1.6, (Math.floor(i / cols) - 2) * 1.8, 0), r: new THREE.Vector3(0, 0, 0), s: 0.85 }
  })
  const heart: Pose[] = parts.map((_, i) => {
    const t = (i / n) * Math.PI * 2
    // Classic heart curve, scaled to sit around the dial.
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return { p: new THREE.Vector3(x * 0.44, y * 0.44 + 0.6, -2.5), r: new THREE.Vector3(0.3, 0.3, t), s: 0.5 }
  })

  // Start scattered.
  parts.forEach((m, i) => {
    m.position.copy(scatter[i].p)
    m.rotation.set(scatter[i].r.x, scatter[i].r.y, scatter[i].r.z)
    m.scale.setScalar(scatter[i].s)
  })

  const labelled = [n - 4, 3, 9, 14, n - 3, n - 2, 20, 27, 31, 24, n - 1]
  return { root, swirl, parts, gears, formations: { scatter, home: homes, exploded, ring, kit, heart }, labelled }
}
