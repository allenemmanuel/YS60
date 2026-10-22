import * as THREE from 'three'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { buildCase, type CaseModel } from '@/morph/three/model'
import { postMaterial, type PostUniforms } from '@/morph/three/shading'

/**
 * The 3D stage. World units are CSS pixels at z = 0 (the camera distance is chosen for that), so the
 * HTML dial (a CSS3DObject) and the WebGL case line up exactly. `world` is what the timeline animates;
 * `rig` holds the responsive offset (lower on phones).
 */
export interface World {
  world: THREE.Group
  model: CaseModel
  uniforms: PostUniforms
  /** Draw a frame. `gl: false` skips the WebGL passes (e.g. while the case is invisible). */
  render(opts?: { gl?: boolean }): void
  /** Screen position (CSS px) of an object's centre. */
  project(obj: THREE.Object3D): { x: number; y: number }
  resize(): void
  destroy(): void
}

const FOV = 40

export function createWorld(container: HTMLElement, dial: HTMLElement): World {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false })
  renderer.setClearColor(0xffffff, 1)
  renderer.domElement.className = 'mx-gl'
  container.prepend(renderer.domElement)

  const css = new CSS3DRenderer()
  css.domElement.className = 'mx-css3d'
  container.appendChild(css.domElement)

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 20000)
  const scene = new THREE.Scene()
  const cssScene = new THREE.Scene()

  const rig = new THREE.Group()
  const world = new THREE.Group()
  rig.add(world)
  scene.add(rig)
  const cssRig = new THREE.Group()
  const cssWorld = new THREE.Group()
  cssRig.add(cssWorld)
  cssScene.add(cssRig)

  const model = buildCase()
  world.add(model.root)
  const dialObj = new CSS3DObject(dial)
  cssWorld.add(dialObj)

  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false })
  const post = postMaterial()
  post.uniforms.tScene.value = target.texture
  const postScene = new THREE.Scene()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post)
  quad.frustumCulled = false
  postScene.add(quad)

  let w = 1
  let h = 1
  const resize = () => {
    w = container.clientWidth
    h = container.clientHeight
    const pr = Math.min(1.25, window.devicePixelRatio || 1)
    renderer.setPixelRatio(pr)
    renderer.setSize(w, h, false)
    css.setSize(w, h)
    target.setSize(Math.round(w * pr), Math.round(h * pr))
    post.uniforms.uResolution.value.set(w * pr, h * pr)
    camera.aspect = w / h
    camera.position.z = h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    camera.near = 1
    camera.far = camera.position.z * 10
    camera.updateProjectionMatrix()
    // Case scaled to the dial: dial ring radius ≈ 0.948 × half the dial size.
    const dialPx = dial.offsetWidth || 600
    model.root.scale.setScalar((dialPx / 2) * 0.95)
    const narrow = w < 640
    rig.position.y = narrow ? -h * 0.14 : 0
  }
  resize()

  const sync = () => {
    cssRig.position.copy(rig.position)
    cssWorld.position.copy(world.position)
    cssWorld.rotation.copy(world.rotation)
    cssWorld.scale.copy(world.scale)
  }

  const render = (opts?: { gl?: boolean }) => {
    sync()
    if (opts?.gl !== false) {
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(postScene, camera)
    }
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
    uniforms: post.uniforms,
    render,
    project,
    resize,
    destroy() {
      renderer.dispose()
      target.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      renderer.domElement.remove()
      css.domElement.remove()
    },
  }
}
