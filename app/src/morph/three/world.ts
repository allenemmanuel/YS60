import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { buildSixty, type Sixty } from '@/morph/three/sixty'

/**
 * The 3D stage. World units are CSS pixels at z = 0 (the camera distance is chosen for that), so the
 * HTML dial (a CSS3DObject) and the WebGL "60" line up. `world` is what the timeline animates;
 * `rig` holds the responsive offset (lower on phones). The canvas is transparent so the page colour
 * (dark or light, animated on <body>) shows through.
 */
export interface World {
  world: THREE.Group
  model: Sixty
  render(): void
  /** Screen position (CSS px) of an object's centre. */
  project(obj: THREE.Object3D): { x: number; y: number }
  resize(): void
  destroy(): void
}

const FOV = 40

export function createWorld(container: HTMLElement, dial: HTMLElement): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.className = 'mx-gl'
  container.prepend(renderer.domElement)

  const css = new CSS3DRenderer()
  css.domElement.className = 'mx-css3d'
  container.appendChild(css.domElement)

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 20000)
  const scene = new THREE.Scene()
  const cssScene = new THREE.Scene()

  // Studio lighting: a soft environment for reflections plus a key light for crisp highlights.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const key = new THREE.DirectionalLight('#ffffff', 1.6)
  key.position.set(-0.6, 1, 1.2)
  scene.add(key)
  scene.add(new THREE.HemisphereLight('#ffffff', '#30302e', 0.35))

  const rig = new THREE.Group()
  const world = new THREE.Group()
  rig.add(world)
  scene.add(rig)
  const cssRig = new THREE.Group()
  const cssWorld = new THREE.Group()
  cssRig.add(cssWorld)
  cssScene.add(cssRig)

  const model = buildSixty()
  world.add(model.root)
  const dialObj = new CSS3DObject(dial)
  cssWorld.add(dialObj)

  let w = 1
  let h = 1
  const resize = () => {
    w = container.clientWidth
    h = container.clientHeight
    renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1))
    renderer.setSize(w, h, false)
    css.setSize(w, h)
    camera.aspect = w / h
    camera.position.z = h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    camera.far = camera.position.z * 10
    camera.updateProjectionMatrix()
    // One grid cell of the "60" relative to the dial: the digits span a bit more than the dial.
    const dialPx = dial.offsetWidth || 600
    model.root.scale.setScalar(dialPx / 9.2)
    rig.position.y = w < 640 ? -h * 0.14 : 0
  }
  resize()

  const render = () => {
    cssRig.position.copy(rig.position)
    cssWorld.position.copy(world.position)
    cssWorld.rotation.copy(world.rotation)
    renderer.render(scene, camera)
    css.render(cssScene, camera)
  }

  const v = new THREE.Vector3()
  const project = (obj: THREE.Object3D) => {
    obj.getWorldPosition(v)
    v.project(camera)
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h }
  }

  return {
    world,
    model,
    render,
    project,
    resize,
    destroy() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      css.domElement.remove()
    },
  }
}
