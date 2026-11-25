import * as THREE from 'three';

/**
 * Oddfish lighting: a night sea. Cool moonlight from above and behind, a warm lantern
 * key from the front, soft navy fill, and a small procedural environment for reflections.
 * Exposure keeps characters readable: never "extremely dark".
 */
export function makeRenderer(canvas: HTMLCanvasElement, alpha = true): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  r.setClearColor(0x000000, 0);
  return r;
}

/** Equirect-style environment painted from a tiny scene: navy sky, moon, warm lantern glow. */
export function nightEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float y = vP.y;
          vec3 top = vec3(0.09, 0.17, 0.29);
          vec3 hor = vec3(0.26, 0.40, 0.50);
          vec3 low = vec3(0.04, 0.09, 0.15);
          vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor * 0.6, low, pow(-y, 0.5));
          float moon = smoothstep(0.985, 0.997, dot(vP, normalize(vec3(-0.5, 0.65, -0.55))));
          float warm = smoothstep(0.75, 1.0, dot(vP, normalize(vec3(0.7, 0.25, 0.65))));
          c += vec3(1.0, 0.94, 0.82) * moon * 6.0 + vec3(1.0, 0.62, 0.28) * warm * 1.4;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  env.add(sky);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

export interface Rig {
  moon: THREE.DirectionalLight;
  lantern: THREE.PointLight;
  key: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
}

export function lightRig(scene: THREE.Scene): Rig {
  const fill = new THREE.HemisphereLight(0x6f97bd, 0x0b1a2a, 0.9);
  const moon = new THREE.DirectionalLight(0xcfe0ff, 1.4);
  moon.position.set(-3, 5, -4);
  const key = new THREE.DirectionalLight(0xffe2b8, 2.1);
  key.position.set(2.5, 3, 4);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 1.6);
  rim.position.set(-2, 1.5, -3.5);
  const lantern = new THREE.PointLight(0xffa64d, 0, 8, 1.6);
  scene.add(fill, moon, key, rim, lantern);
  return { moon, lantern, key, fill, rim };
}
