import * as THREE from 'three';

/**
 * Stylised night sea: Gerstner waves with analytic normals, moonlight glitter,
 * a warm lantern reflection, ripple rings for catches, and fog into the horizon.
 */
const WAVES = [
  // dir.x, dir.y, steepness, wavelength
  [1.0, 0.25, 0.16, 7.0],
  [-0.6, 1.0, 0.12, 4.2],
  [0.35, -0.9, 0.1, 2.6],
  [-1.0, -0.4, 0.06, 1.5],
];

export const SEA_LEVEL = 0.18;
/** Where the moon hangs: low and to the left, so it shows on Home but stays clear of titles elsewhere. */
export const MOON_DIR = new THREE.Vector3(-0.51, 0.118, -1).normalize();
export const HORIZON = new THREE.Color('#24465e');
export const ZENITH = new THREE.Color('#0a1828');

export interface Ocean {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  heightAt(x: number, z: number, t: number): number;
  ripple(x: number, z: number, t: number, strength?: number): void;
}

export function makeOcean(): Ocean {
  const geo = new THREE.PlaneGeometry(90, 90, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uMoonDir: { value: MOON_DIR },
    uLantern: { value: new THREE.Vector3(1.3, 1.2, 0) },
    uLanternI: { value: 1 },
    uRipple: { value: new THREE.Vector4(0, 0, -100, 0) },
    uDeep: { value: new THREE.Color('#0a2031') },
    uShallow: { value: new THREE.Color('#1f4a63') },
    uSky: { value: new THREE.Color('#2c5170') },
    uHorizon: { value: HORIZON },
    uCalm: { value: 0.75 },
  };
  const waves = WAVES.map((w) => `vec4(${w.map((n) => n.toFixed(3)).join(',')})`).join(',');
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime, uCalm;
      uniform vec4 uRipple;
      varying vec3 vW; varying vec3 vN; varying float vFoam;
      const vec4 W[4] = vec4[4](${waves});
      void main() {
        vec3 p = position;
        vec3 n = vec3(0.0, 1.0, 0.0);
        vec3 d = vec3(0.0);
        float foam = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 dir = normalize(W[i].xy);
          float k = 6.2831 / W[i].w;
          float c = sqrt(9.8 / k);
          float a = W[i].z / k * uCalm;
          float f = k * (dot(dir, p.xz) - c * uTime * 0.55);
          d.x += dir.x * a * cos(f);
          d.z += dir.y * a * cos(f);
          d.y += a * sin(f);
          n.x -= dir.x * k * a * cos(f);
          n.z -= dir.y * k * a * cos(f);
          n.y -= W[i].z * uCalm * sin(f) * 0.6;
          foam += max(0.0, sin(f)) * W[i].z;
        }
        // ripple rings from a catch
        float age = uTime - uRipple.z;
        if (age > 0.0 && age < 3.0) {
          float r = length(p.xz - uRipple.xy);
          float ring = sin(r * 9.0 - age * 9.0) * exp(-r * 0.9) * exp(-age * 1.4) * uRipple.w * smoothstep(age * 3.2 + 0.4, age * 3.2 - 0.4, r);
          d.y += ring * 0.12;
          n.xz -= normalize(p.xz - uRipple.xy + 1e-4) * ring * 0.9;
        }
        p += d;
        vN = normalize(n);
        vFoam = foam;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uMoonDir, uLantern, uDeep, uShallow, uSky, uHorizon;
      uniform float uTime, uLanternI;
      varying vec3 vW; varying vec3 vN; varying float vFoam;
      // Small wind ripples, added per pixel so highlights break into glints.
      vec2 detail(vec2 p, float t) {
        vec2 g = vec2(0.0);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 9.0 - t * 2.1) * 0.10;
        g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 13.0 - t * 2.7) * 0.08;
        g += vec2(0.96, -0.28) * cos(dot(p, vec2(0.96, -0.28)) * 21.0 - t * 3.4) * 0.06;
        g += vec2(-0.2, -0.98) * cos(dot(p, vec2(-0.2, -0.98)) * 31.0 - t * 4.1) * 0.045;
        return g;
      }
      void main() {
        float dist = length(vW.xz - cameraPosition.xz);
        vec3 N = normalize(vN);
        // fade detail with distance so far water stays calm instead of aliasing
        vec2 dg = detail(vW.xz, uTime) * 0.42 * (1.0 - smoothstep(4.0, 22.0, dist));
        N = normalize(N + vec3(dg.x, 0.0, dg.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 col = mix(uDeep, uShallow, clamp(vFoam * 2.2, 0.0, 1.0) * 0.5);
        col = mix(col, uSky, fres * 0.9);
        vec3 R = reflect(-V, N);
        // moonlight path: glints that shimmer, plus a soft sheen along the path
        float m = max(dot(R, uMoonDir), 0.0);
        // kept off the water right under the reader's text
        float near = smoothstep(2.5, 9.0, dist);
        col += vec3(1.0, 0.92, 0.76) * (pow(m, 1400.0) * 3.2 + pow(m, 120.0) * 0.09) * near;
        // lantern: a warm column of glints under the bow, a faint glow around it
        vec3 L = normalize(uLantern - vW);
        float l = max(dot(R, L), 0.0);
        float ld = length(uLantern.xz - vW.xz);
        col += vec3(1.0, 0.64, 0.3) * (pow(l, 500.0) * 4.0 * near + pow(l, 40.0) * 0.1) * uLanternI / (1.0 + ld * ld * 0.15);
        col += vec3(1.0, 0.6, 0.28) * 0.05 * uLanternI * exp(-ld * ld * 0.6);
        float fog = smoothstep(10.0, 46.0, dist);
        col = mix(col, uHorizon, fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = SEA_LEVEL;
  mesh.frustumCulled = false;
  return {
    mesh,
    uniforms,
    heightAt(x, z, t) {
      let y = 0;
      const calm = uniforms.uCalm.value as number;
      for (const w of WAVES) {
        const len = Math.hypot(w[0], w[1]);
        const dx = w[0] / len, dz = w[1] / len;
        const k = (2 * Math.PI) / w[3];
        const c = Math.sqrt(9.8 / k);
        const a = (w[2] / k) * calm;
        y += a * Math.sin(k * (dx * x + dz * z - c * t * 0.55));
      }
      return SEA_LEVEL + y;
    },
    ripple(x, z, t, strength = 1) {
      (uniforms.uRipple.value as THREE.Vector4).set(x, z, t, strength);
    },
  };
}

/** Sky dome: navy gradient, a soft moon, a scattering of stars. */
export function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uMoonDir: { value: MOON_DIR }, uTime: { value: 0 }, uHorizon: { value: HORIZON }, uZenith: { value: ZENITH }, uMoon: { value: 1 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uMoonDir, uHorizon, uZenith; uniform float uTime, uMoon, uFlash;
      varying vec3 vD;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vD);
        float y = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.22, y));
        col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.05, y));
        float md = dot(d, uMoonDir);
        // halo, then the disc with a faint terminator for a little form
        col += vec3(0.95, 0.8, 0.55) * (pow(max(md, 0.0), 2500.0) * 0.35 + pow(max(md, 0.0), 60.0) * 0.06) * uMoon;
        float disc = smoothstep(0.99972, 0.99982, md);
        vec3 moon = vec3(1.0, 0.93, 0.78) * (0.92 + 0.08 * smoothstep(-0.02, 0.02, dot(d - uMoonDir, vec3(0.7, 0.7, 0.0))));
        col = mix(col, moon * 1.15, disc * uMoon);
        // stars: round points on a fine grid, fading toward the horizon
        vec3 g = d * 220.0;
        vec3 cell = floor(g);
        float s = hash(cell);
        float r = length(fract(g) - 0.5);
        float tw = 0.55 + 0.45 * sin(uTime * (0.7 + s * 2.4) + s * 40.0);
        float star = step(0.993, s) * smoothstep(0.3, 0.0, r) * smoothstep(0.015, 0.12, y) * tw * (0.5 + 0.5 * fract(s * 91.0));
        col += vec3(1.0, 0.96, 0.88) * star * 0.85 * uMoon;
        // lightning lights the clouds from behind
        col += vec3(0.75, 0.82, 1.0) * uFlash * (0.35 + 0.65 * smoothstep(-0.05, 0.5, y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}
