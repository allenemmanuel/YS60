import * as THREE from 'three'
import { partMaterial } from '@/morph/three/shading'

/**
 * Our own "engine case", built from primitives in unit size (dial radius ≈ 1, axis along +z towards the viewer).
 * Parts: bezel ring (case01), three front plates and three back plates (case02), a slotted vent,
 * and 11 module parts (one per toolbox label, same order).
 */

let idSeed = 0
const nextId = () => new THREE.Color().setHSL((idSeed++ * 0.618034) % 1, 0.75, 0.5)
const mesh = (geo: THREE.BufferGeometry) => new THREE.Mesh(geo, partMaterial(nextId()))

/** Geometry for a ring (annulus) with depth, its axis along z. */
function ringGeometry(rIn: number, rOut: number, depth: number, chamfer = 0.03) {
  const pts = [
    new THREE.Vector2(rIn, -depth / 2),
    new THREE.Vector2(rOut - chamfer, -depth / 2),
    new THREE.Vector2(rOut, -depth / 2 + chamfer),
    new THREE.Vector2(rOut, depth / 2 - chamfer),
    new THREE.Vector2(rOut - chamfer, depth / 2),
    new THREE.Vector2(rIn, depth / 2),
    new THREE.Vector2(rIn, -depth / 2),
  ]
  const g = new THREE.LatheGeometry(pts, 96)
  g.rotateX(Math.PI / 2)
  return g
}

/** One third of a disc (a plate), facing +z. */
function plateGeometry(k: number, r: number, thick: number) {
  const g = new THREE.CylinderGeometry(r, r, thick, 48, 1, false, (k * 2 * Math.PI) / 3 + 0.03, (2 * Math.PI) / 3 - 0.06)
  g.rotateX(Math.PI / 2)
  return g
}

function gearGeometry(r: number, teeth: number, depth: number) {
  const s = new THREE.Shape()
  const steps = teeth * 4
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const rr = i % 4 < 2 ? r : r * 0.82
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  const hole = new THREE.Path()
  hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true)
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false })
  g.translate(0, 0, -depth / 2)
  return g
}

function tubeAlong(points: THREE.Vector3[], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, radius, 10, false)
}

export interface CaseModel {
  root: THREE.Group
  caseRing: THREE.Object3D
  front: THREE.Object3D[]
  back: THREE.Object3D[]
  vent: THREE.Object3D
  modules: THREE.Object3D[]
  /** Collapsed (inside the case) positions of the modules. */
  homes: THREE.Vector3[]
}

export function buildCase(): CaseModel {
  idSeed = 0
  const root = new THREE.Group()

  // Bezel ring with four lugs.
  const caseRing = new THREE.Group()
  caseRing.add(mesh(ringGeometry(1.0, 1.13, 0.26)))
  for (let i = 0; i < 4; i++) {
    const lug = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.2))
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    lug.position.set(Math.cos(a) * 1.18, Math.sin(a) * 1.18, -0.02)
    lug.rotation.z = a
    caseRing.add(lug)
  }
  root.add(caseRing)

  // Front plates sit just behind the dial; back plates close the case.
  const front = [0, 1, 2].map((k) => {
    const m = mesh(plateGeometry(k, 0.99, 0.03))
    m.position.z = -0.06
    return m
  })
  const back = [0, 1, 2].map((k) => {
    const m = mesh(plateGeometry(k, 1.05, 0.05))
    m.position.z = -0.42
    return m
  })
  front.forEach((m) => root.add(m))
  back.forEach((m) => root.add(m))

  // Slotted vent on the back.
  const vent = new THREE.Group()
  vent.add(mesh(ringGeometry(0.42, 0.62, 0.05, 0.01)))
  for (let i = 0; i < 18; i++) {
    const slot = mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05))
    const a = (i / 18) * Math.PI * 2
    slot.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0)
    slot.rotation.z = a
    vent.add(slot)
  }
  vent.position.z = -0.48
  root.add(vent)

  // Modules, in toolbox label order: timer, easings, draggable, scroll, scope, waapi, timeline, stagger, svg, spring, animation.
  const helix = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39
    return new THREE.Vector3(Math.cos(t * Math.PI * 8) * 0.12, Math.sin(t * Math.PI * 8) * 0.12, t * 0.5 - 0.25)
  })
  const sCurve = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19
    return new THREE.Vector3(t * 0.5 - 0.25, Math.tanh((t - 0.5) * 6) * 0.15, 0)
  })
  const group = (...children: THREE.Object3D[]) => {
    const g = new THREE.Group()
    children.forEach((c) => g.add(c))
    return g
  }
  const at = (o: THREE.Object3D, x: number, y: number, z: number) => {
    o.position.set(x, y, z)
    return o
  }
  const modules: THREE.Object3D[] = [
    group(mesh(gearGeometry(0.26, 12, 0.08))), // timer
    group(mesh(tubeAlong(sCurve, 0.035)), at(mesh(new THREE.BoxGeometry(0.56, 0.36, 0.03)), 0, 0, -0.06)), // easings
    group(mesh(new THREE.SphereGeometry(0.17, 32, 16)), mesh(new THREE.TorusGeometry(0.24, 0.025, 10, 48))), // draggable
    group(at(mesh(new THREE.CapsuleGeometry(0.07, 0.3, 8, 16)), -0.1, 0, 0), at(mesh(new THREE.CapsuleGeometry(0.07, 0.2, 8, 16)), 0.1, 0.05, 0)), // scroll
    group(mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34)), at(mesh(new THREE.BoxGeometry(0.18, 0.18, 0.36)), 0, 0, 0.02)), // scope
    group(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 40).rotateX(Math.PI / 2)), at(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)), 0, 0.22, 0)), // waapi
    group(...[0.5, 0.36, 0.44, 0.24].map((w, i) => at(mesh(new THREE.BoxGeometry(w, 0.07, 0.07)), (w - 0.5) / 2, i * 0.11 - 0.17, 0))), // timeline
    group(...Array.from({ length: 9 }, (_, i) => at(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 16).rotateX(Math.PI / 2)), ((i % 3) - 1) * 0.13, (Math.floor(i / 3) - 1) * 0.13, 0))), // stagger
    group(mesh(new THREE.TorusKnotGeometry(0.15, 0.035, 96, 10))), // svg
    group(mesh(tubeAlong(helix, 0.025))), // spring
    group(mesh(new THREE.ConeGeometry(0.17, 0.36, 32).rotateX(Math.PI / 2))), // animation
  ]
  // Collapsed: packed inside the case behind the dial.
  const homes = modules.map((_, i) => {
    const a = (i / modules.length) * Math.PI * 2
    const r = i % 2 ? 0.55 : 0.32
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.22 - (i % 3) * 0.05)
  })
  modules.forEach((m, i) => {
    m.position.copy(homes[i])
    m.scale.setScalar(0.85)
    root.add(m)
  })

  return { root, caseRing, front, back, vent, modules, homes }
}

/** Exploded-view offset for module i: pushed back along the case axis and outwards, so the stack fans out diagonally when tilted. */
export function explodedPosition(i: number, count: number): THREE.Vector3 {
  const a = (i / count) * Math.PI * 2 + 0.3
  const r = 0.85 + (i % 3) * 0.22
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.75 - (i % 4) * 0.42)
}
