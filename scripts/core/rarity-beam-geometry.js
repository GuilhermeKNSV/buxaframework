/** Normalized linework shared by canvas beam renderers. Paths use x in beam
 * widths and y in beam heights. Built once at creation, never redrawn per tick. */
const TRACES = Object.freeze({
  dust: [[[-.3,0],[.1,-.13],[.2,-.2]]],
  shaft: [[[-.22,0],[-.22,-.7]],[[.22,0],[.22,-.7]]],
  wisp: [[[-.2,0],[-1,-.25],[.7,-.5],[0,-.9]],[[.3,0],[1,-.2],[-.5,-.5],[.2,-.78]]],
  lattice: [[[-.6,-.18],[.6,-.18],[.6,-.3],[-.6,-.3],[-.6,-.18]],[[-.45,-.5],[.45,-.5],[.45,-.6],[-.45,-.6],[-.45,-.5]]],
  helix: [[[-.4,0],[1.6,-.3],[-1.6,-.65],[.2,-1]],[[.4,0],[-1.6,-.3],[1.6,-.65],[-.2,-1]]],
  flame: [[[-.8,0],[-.5,-.3],[-.1,-.35],[-.35,-.63],[0,-.95]],[[.8,0],[.5,-.22],[.1,-.4],[.3,-.6],[0,-.95]]],
  prism: [[[0,-.15],[-.7,-.5],[0,-.98],[.7,-.5],[0,-.15]],[[-.7,-.5],[.7,-.5]]],
  votive: [[[-.8,0],[-.8,-.6],[-.5,-.68],[-.5,-.15]],[[.8,0],[.8,-.6],[.5,-.68],[.5,-.15]],[[-.3,-.8],[.3,-.8]]],
  forge: [[[-.6,0],[-.6,-.75],[-.3,-.8],[-.3,-.1]],[[.6,0],[.6,-.75],[.3,-.8],[.3,-.1]],[[-.6,-.5],[.6,-.5]]],
  rift: [[[-.5,0],[-.8,-.12],[-.3,-.3],[-.65,-.5],[-.05,-.95]],[[.5,0],[.7,-.25],[.3,-.45],[.65,-.6],[.05,-.95]]],
  spire: [[[0,0],[0,-1.04]],[[-.7,-.66],[0,-.85],[.7,-.66]],[[-.35,-.42],[0,-.54],[.35,-.42]]],
  rupture: [[[-.8,0],[-.25,-.28],[-.8,-.4],[.1,-.7],[-.2,-1]],[[.8,0],[.25,-.2],[.65,-.45],[-.1,-.6],[.2,-1]]]
});
export function rarityBeamTraces(theme, height, width) {
  return (TRACES[theme.beamProfile] ?? TRACES.shaft).map(path => path.map(([x, y]) => [x * width, y * height]));
}

export function rarityBeamMotion(theme, time, seed = 0) {
  // Common/Junk use a still *card* profile; their loot beams must still flow.
  const speed = Number(theme?.speed) > 0 ? Number(theme.speed) : .65;
  const t = time * speed + seed;
  const phase = ((t * .18) % 1 + 1) % 1;
  const p = theme.beamProfile;
  return {
    x: p === 'forge' || p === 'lattice' || p === 'spire' ? Math.sin(seed * 6.4) * 6
      : p === 'rift' ? Math.sin(t * .65 + seed) * (14 - phase * 8)
      : p === 'rupture' ? Math.sin(seed * 6.4) * (3 + phase * 22)
      : Math.sin(seed * 6.4 + t * 1.1) * (5 + phase * 8),
    phase, alpha: Math.sin(phase * Math.PI) * .8
  };
}
