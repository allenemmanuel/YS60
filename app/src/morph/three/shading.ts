import * as THREE from 'three'

/**
 * Two-pass "technical drawing" look.
 * Pass 1 (per mesh): RGB = the part's ID colour mixed with its view-space normal, so silhouettes and
 * creases become colour edges; A = a soft light term.
 * Pass 2 (full screen): edge detection on that image draws outlines; surfaces get a flat paint colour
 * with a lit and a shadow tone; pure white (the clear colour) is the background.
 */

export function partMaterial(id: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uId: { value: new THREE.Color(id) },
      uLight: { value: new THREE.Vector3(-0.45, 0.6, 0.65).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uId;
      uniform vec3 uLight;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float lit = clamp(dot(n, uLight) * 0.5 + 0.5, 0.0, 1.0);
        // Keep away from pure white, which marks the background.
        vec3 code = mix(uId, n * 0.5 + 0.5, 0.45) * 0.92;
        gl_FragColor = vec4(code, lit);
      }
    `,
  })
}

export interface PostUniforms {
  tScene: { value: THREE.Texture | null }
  uResolution: { value: THREE.Vector2 }
  uThickness: { value: number }
  /** 0 = dark page, 1 = light page. */
  uLightMode: { value: number }
  /** 0 = the 3D parts are invisible (only background), 1 = fully drawn. */
  uLines: { value: number }
}

export function postMaterial(): THREE.ShaderMaterial & { uniforms: PostUniforms } {
  const uniforms: PostUniforms = {
    tScene: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uThickness: { value: 1.25 },
    uLightMode: { value: 0 },
    uLines: { value: 0 },
  }
  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene;
      uniform vec2 uResolution;
      uniform float uThickness;
      uniform float uLightMode;
      uniform float uLines;
      varying vec2 vUv;

      // Dark page / light page palettes.
      const vec3 BG_D = vec3(0.145, 0.141, 0.137);
      const vec3 BG_L = vec3(0.855, 0.835, 0.812);
      const vec3 PAINT_D = vec3(0.165, 0.161, 0.157);
      const vec3 PAINT_L = vec3(0.878, 0.863, 0.843);
      const vec3 LINE_D = vec3(0.43, 0.41, 0.40);
      const vec3 LINE_L = vec3(0.23, 0.22, 0.21);
      const vec3 SHADOW_D = vec3(0.12, 0.118, 0.114);
      const vec3 SHADOW_L = vec3(0.76, 0.74, 0.715);
      const vec3 RIM_D = vec3(0.22, 0.215, 0.21);
      const vec3 RIM_L = vec3(0.95, 0.94, 0.925);

      void main() {
        vec2 px = uThickness / uResolution;
        vec4 c = texture2D(tScene, vUv);
        vec3 a = texture2D(tScene, vUv - px).rgb;
        vec3 b = texture2D(tScene, vUv + px).rgb;
        vec3 d = texture2D(tScene, vUv + vec2(px.x, -px.y)).rgb;
        vec3 e = texture2D(tScene, vUv + vec2(-px.x, px.y)).rgb;
        vec3 g0 = b - a;
        vec3 g1 = e - d;
        float edge = step(0.12, sqrt(dot(g0, g0) + dot(g1, g1)));

        vec3 bg = mix(BG_D, BG_L, uLightMode);
        bool isBg = all(greaterThan(c.rgb, vec3(0.985)));
        vec3 paint = mix(PAINT_D, PAINT_L, uLightMode);
        if (c.a > 0.82) paint = mix(paint, mix(RIM_D, RIM_L, uLightMode), 0.6);
        else if (c.a < 0.38) paint = mix(paint, mix(SHADOW_D, SHADOW_L, uLightMode), 0.75);
        vec3 line = mix(LINE_D, LINE_L, uLightMode);

        vec3 surface = isBg ? bg : paint;
        vec3 drawn = mix(surface, line, edge);
        gl_FragColor = vec4(mix(bg, drawn, uLines), 1.0);
      }
    `,
  }) as THREE.ShaderMaterial & { uniforms: PostUniforms }
}
