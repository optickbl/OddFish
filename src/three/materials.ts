import * as THREE from 'three';

/**
 * Creature palettes. Each model carries masks (see art/lib.py); these colours fill them.
 * main = back/body, belly = underside (mask R), light = light markings (mask G),
 * dark = dark markings (mask B). Mask A is the swim bend weight.
 */
export interface CreaturePalette {
  main: string;
  belly: string;
  light: string;
  dark: string;
  bellyMetal?: number;
  roughness?: number;
  glow?: number;
  iridescence?: number;
  /** Wet-look gloss; dry things (wood, leather) turn it down. */
  clearcoat?: number;
}

export interface SwimParams {
  speed: number;
  freq: number;
  amp: number;
  /** 'fish' bends sideways; 'tentacle' curls vertically; 'serpent' undulates. */
  style: 'fish' | 'tentacle' | 'serpent' | 'none';
}

export const clock = { t: 0 };

/** A physical material whose colour comes from the model's mask attribute. */
export type Pattern = 'sardine' | 'clownfish' | 'octopus' | 'swordfish' | 'leviathan' | 'boot' | 'cat' | 'wood' | 'none';

/** Markings drawn per pixel from the model's own coordinates, so edges stay crisp at any size. */
const PATTERNS = `
varying vec3 vPos;
void oddPattern(inout float lt, inout float dk, float belly) {
  vec3 P = vPos;
#ifdef PAT_SARDINE
  const vec2 SP[6] = vec2[6](vec2(.52,.075), vec2(.41,.08), vec2(.3,.082), vec2(.19,.08), vec2(.08,.076), vec2(-.03,.07));
  float side = step(.03, abs(P.z));
  for (int i = 0; i < 6; i++) {
    float d = length(vec2(P.x - SP[i].x, (P.y - SP[i].y) * 1.2));
    dk = max(dk, (1.0 - smoothstep(.009, .016, d)) * side);
  }
  float line = abs(P.y - .03);
  lt = max(lt, (1.0 - smoothstep(.003, .011, line)) * .7 * smoothstep(-.45, -.25, P.x) * (1.0 - smoothstep(.6, .68, P.x)) * step(.05, abs(P.z)));
  float gill = abs(P.x - (.71 - 6.0 * (P.y - .02) * (P.y - .02)));
  dk = max(dk, (1.0 - smoothstep(.002, .007, gill)) * .4 * step(abs(P.y - .02), .15) * side);
#endif
#ifdef PAT_CLOWNFISH
  const vec2 BD[3] = vec2[3](vec2(.5, .056), vec2(.03, .072), vec2(-.43, .036));
  for (int i = 0; i < 3; i++) {
    float c = 1.6 * (P.y - .005) * (P.y - .005) * (i < 2 ? 1.0 : -.5);
    float d = abs(P.x - (BD[i].x + c));
    float w = BD[i].y;
    lt = max(lt, 1.0 - smoothstep(w - .003, w + .002, d));
    dk = max(dk, (1.0 - smoothstep(w + .012, w + .019, d)) * smoothstep(w - .001, w + .004, d));
  }
#endif
#ifdef PAT_SWORDFISH
  lt = max(lt, (1.0 - smoothstep(.002, .01, abs(P.y - .03))) * .3 * step(.04, abs(P.z)) * (1.0 - smoothstep(.45, .55, P.x)));
#endif
#ifdef PAT_LEVIATHAN
  float sideL = smoothstep(.05, .1, abs(P.z));
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float x = .7 - fi * .17;
    float r1 = .018 + .004 * sin(fi);
    lt = max(lt, (1.0 - smoothstep(r1 * .45, r1, length(vec2(P.x - x, P.y - (.13 - fi * .01))))) * sideL);
    lt = max(lt, (1.0 - smoothstep(.006, .013, length(vec2(P.x - (x - .08), P.y - (.05 - fi * .008))))) * sideL);
    float top = .02 + .29 * exp(-pow((x - .45) / .75, 2.0));
    lt = max(lt, (1.0 - smoothstep(.006, .012, length(vec3(P.x - x, P.y - top + .012, P.z * .8)))));
  }
  dk = max(dk, (1.0 - smoothstep(.05, .3, abs(sin(P.z * 70.0)))) * .28 * smoothstep(.5, .8, belly) * smoothstep(.15, .45, P.x));
#endif
#ifdef PAT_OCTOPUS
  float m = .5 + .5 * sin(P.x * 23.0) * sin(P.z * 21.0) * sin(P.y * 19.0);
  dk = max(dk, smoothstep(.8, .92, m) * .45 * (1.0 - belly));
#endif
#ifdef PAT_CAT
  // Tabby stripes on the cheeks and the back of the head, rings on the tail.
  float headZone = smoothstep(.7, .78, P.y) * (1.0 - smoothstep(1.3, 1.4, P.y));
  float cheek = smoothstep(.26, .36, abs(P.x)) * headZone * step(P.z, .25);
  float back = smoothstep(-.05, -.25, P.z) * headZone;
  float st = smoothstep(.55, .85, sin(P.y * 42.0 + abs(P.x) * 9.0));
  dk = max(dk, st * max(cheek, back) * .55 * (1.0 - belly));
  float tail = step(P.y, .25) * smoothstep(.2, .3, length(P.xz));
  dk = max(dk, smoothstep(.6, .9, sin((P.x - P.z) * 26.0)) * tail * .55);
#endif
#ifdef PAT_WOOD
  float plank = fract(P.y * 11.0 + .3);
  dk = max(dk, (1.0 - smoothstep(.0, .06, plank)) * .55);
  float grain = .5 + .5 * sin(P.x * 38.0 + sin(P.y * 24.0 + P.x * 3.0) * 2.2);
  dk = max(dk, smoothstep(.7, 1.0, grain) * .18);
  lt = max(lt, (1.0 - smoothstep(.0, .012, abs(P.y - .395) - .022)) * step(.25, abs(P.z)));
#endif
#ifdef PAT_BOOT
  float sc = .5 + .5 * sin(P.x * 37.0 + P.y * 11.0) * sin(P.z * 29.0 - P.x * 7.0);
  dk = max(dk, smoothstep(.78, .95, sc) * .45);
  float cr = abs(sin(P.y * 34.0 + P.x * 4.0));
  dk = max(dk, (1.0 - smoothstep(0.0, .12, cr)) * .22 * smoothstep(.25, .35, P.y));
#endif
}
`;

export function creatureMaterial(p: CreaturePalette, swim: SwimParams, fin = false, pattern: Pattern = 'none'): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: p.roughness ?? 0.42,
    metalness: 0,
    clearcoat: p.clearcoat ?? 0.55,
    clearcoatRoughness: 0.32,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(p.belly),
    iridescence: p.iridescence ?? 0,
    iridescenceIOR: 1.3,
    ...(fin ? { transparent: true, side: THREE.DoubleSide, clearcoat: 0.25, roughness: 0.45, depthWrite: true } : {}),
  });
  const u = {
    uMain: { value: new THREE.Color(p.main) },
    uBelly: { value: new THREE.Color(p.belly) },
    uLight: { value: new THREE.Color(p.light) },
    uDark: { value: new THREE.Color(p.dark) },
    uBellyMetal: { value: p.bellyMetal ?? 0 },
    uGlow: { value: p.glow ?? 0 },
    uTime: { value: 0 },
    uSpeed: { value: swim.speed },
    uFreq: { value: swim.freq },
    uAmp: { value: swim.amp },
    uStyle: { value: { fish: 0, tentacle: 1, serpent: 2, none: 3 }[swim.style] },
    uExcite: { value: 0 },
    uSilhouette: { value: 0 },
  };
  m.userData.uniforms = u;
  m.defines = { ...(fin ? { ODD_FIN: '' } : { [`PAT_${pattern.toUpperCase()}`]: '' }) };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 color;
        varying vec4 vMask;
        varying vec3 vPos;
        uniform float uTime, uSpeed, uFreq, uAmp, uStyle, uExcite;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMask = color;
        vPos = position;
        float w = color.a;
        float sp = uSpeed * (1.0 + uExcite * 1.6);
        float am = uAmp * (1.0 + uExcite * 1.2);
        if (uStyle < 0.5) {
          float ph = uTime * sp - position.x * uFreq;
          transformed.z += sin(ph) * am * w * w;
          transformed.x -= abs(sin(ph)) * am * 0.15 * w;
        } else if (uStyle < 1.5) {
          float ph = uTime * sp + position.x * 3.0 + position.z * 2.0;
          transformed.x += sin(ph) * am * w * 0.6;
          transformed.z += cos(ph * 0.9) * am * w * 0.6;
          transformed.y += sin(ph * 1.3) * am * w * 0.25;
        } else if (uStyle < 2.5) {
          float ph = uTime * sp - position.x * uFreq;
          transformed.y += sin(ph) * am * w;
          transformed.z += sin(ph * 0.5 + 1.0) * am * 0.35 * w;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vMask;
        uniform vec3 uMain, uBelly, uLight, uDark;
        uniform float uBellyMetal, uGlow, uTime, uSilhouette;
        ${PATTERNS}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float lt = clamp(vMask.g, 0.0, 1.0);
        float dk = clamp(vMask.b, 0.0, 1.0);
        #ifndef ODD_FIN
          oddPattern(lt, dk, vMask.r);
        #endif
        #ifdef ODD_FIN
          vec3 base = mix(uMain, mix(uMain, uBelly, 0.6), vMask.r);
        #else
          vec3 base = mix(uMain, uBelly, vMask.r);
        #endif
        base = mix(base, uDark, dk);
        base = mix(base, uLight, lt);
        base = mix(base, vec3(0.13, 0.26, 0.35), uSilhouette);
        #ifdef ODD_FIN
          vec4 diffuseColor = vec4( base, mix(0.96, 0.62, vMask.r) );
        #else
          vec4 diffuseColor = vec4( base, opacity );
        #endif`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, uBellyMetal, vMask.r * (1.0 - lt) * (1.0 - uSilhouette));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uLight * lt * uGlow * (0.6 + 0.4 * sin(uTime * 1.6 + vPos.x * 5.0)) * (1.0 - uSilhouette);`);
  };
  m.customProgramCacheKey = () => (fin ? 'oddfish-fin' : `oddfish-${pattern}`);
  return m;
}

export function eyeMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 });
}

/** Animate every creature material in a tree. */
export function tickMaterials(root: THREE.Object3D, t: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    const u = m?.userData?.uniforms;
    if (u) u.uTime.value = t;
  });
}
