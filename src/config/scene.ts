/**
 * Global scene settings. World units are metres.
 *
 * The scene is the quiet half hour before sunrise: a cool blue-grey sky that is
 * only just brightening at the horizon, no direct sun, and a faint haze.
 */
/** Internal render height in pixels; width follows the viewport aspect. Change this to taste. */
export const RETRO_RENDER_HEIGHT = 360

/** Pixel ratio that makes the drawing buffer RETRO_RENDER_HEIGHT tall (never above 1:1 on small screens). The epsilon guards three's floor(). */
export function retroDpr(viewportHeight: number): number {
  return Math.min(1, (RETRO_RENDER_HEIGHT + 0.01) / Math.max(1, viewportHeight))
}

/**
 * Pre-dawn look: the few numbers worth tuning. Everything below reads from these.
 *
 * FOG_DENSITY is for three's native FogExp2 (one fog, no post-processing). The clear
 * share of the view at distance d is exp(-(d * FOG_DENSITY)^2): about 90% at 20 m,
 * 55% at 50 m, 20% at 80 m and under 5% by 110 m. Raise it for a thicker haze.
 */
export const FOG_COLOR = '#445166'
export const FOG_DENSITY = 0.0175
/** Scales both the hemisphere and the fill light. 1 = authored values; this is the ambient level. */
export const AMBIENT_INTENSITY = 1
/** Beyond this the fog has swallowed everything (over 98%), so geometry can be skipped without a visible pop. */
export const FOG_CULL_DISTANCE = 2.1 / FOG_DENSITY

export const SCENE = {
  sky: FOG_COLOR,
  /** Haze colour matches the lower sky so distant streets fade into it. */
  fog: { color: FOG_COLOR, density: FOG_DENSITY },
  ground: { size: 700, color: '#65625d' },
  camera: { fov: 70, near: 0.1, far: 400 },
  skyDome: {
    radius: 380,
    zenith: '#141a24',
    mid: '#2b3646',
    horizon: FOG_COLOR,
    /** Faint warm band low on the eastern horizon. */
    glow: '#8a7a74',
  },
  lighting: {
    // Physically based units: hemisphere light is divided by π in the shader.
    hemisphere: { sky: '#8794ab', ground: '#4a4643', intensity: 5.3 * AMBIENT_INTENSITY },
    /** A dim cool fill from above, with no shadows. It only gives faces some direction. */
    fill: { color: '#b4bdd0', intensity: 1.2 * AMBIENT_INTENSITY, position: [-60, 90, 40] as const },
  },
} as const
