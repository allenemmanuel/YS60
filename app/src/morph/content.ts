/** Chapters, copy and colours for the /morph scroll study. Copy is our own; structure follows the reference page. */

export interface Feature {
  id: string
  title: string
  body: string
  points: string[]
  color: string
}

export const FEATURES: Feature[] = [
  { id: 'intuitive', title: 'Easy to direct', body: 'One call sets a shape in motion. Change a value and it follows.', points: ['Per-property settings', 'Keyframes', 'Built-in easings'], color: '#ff4b4b' },
  { id: 'composition', title: 'Layers that blend', body: 'Start new motion mid-flight and it blends with what was already running.', points: ['Replace', 'Blend', 'Add'], color: '#ff7d36' },
  { id: 'scroll', title: 'Driven by scroll', body: 'Tie any animation to the page. Scroll down to draw, scroll up to rewind.', points: ['Synced playback', 'Enter and leave points', 'Smoothing'], color: '#3ee8c0' },
  { id: 'staggering', title: 'Ripples on cue', body: 'Offset many elements from one point and let the wave spread outward.', points: ['From the centre', 'Grids', 'Ranges'], color: '#f9f640' },
  { id: 'svg', title: 'Lines that travel', body: 'Draw a path, ride along it, then morph it into another.', points: ['Line drawing', 'Motion paths', 'Shape morphing'], color: '#22d3ee' },
  { id: 'draggable', title: 'Pick it up', body: 'Grab the disc, throw it, and watch it spring back into place.', points: ['Throw and snap', 'Spring release', 'Bounds'], color: '#b8ff57' },
  { id: 'clockwork', title: 'Runs like clockwork', body: 'Sequence many moves on one timeline and keep every beat in step.', points: ['Timelines', 'Labels', 'Callbacks'], color: '#ffb02e' },
  { id: 'responsive', title: 'Fits any screen', body: 'Layouts change size; the motion adapts with them.', points: ['Media queries', 'Scoped setup', 'Clean-up'], color: '#3ee88f' },
]

/** Scroll lengths (in viewport heights) for each chapter; this is what makes the page long. */
export const CHAPTERS = [
  { id: 'intro', label: 'HEADING', length: 1 },
  { id: 'toolbox', label: 'TOOLBOX', length: 2.6 },
  ...FEATURES.map((f) => ({ id: f.id, label: `F_${f.id}`, length: 1 })),
  { id: 'modules', label: 'MODULES', length: 2.4 },
  { id: 'sponsors', label: 'SPONSORS', length: 1.2 },
  { id: 'end', label: 'END', length: 1 },
] as const

/** Parts named by the leader lines in the toolbox chapter (left column, right column). */
export const PARTS_LEFT = ['timer', 'easings', 'draggable', 'scroll', 'scope']
export const PARTS_RIGHT = ['waapi', 'timeline', 'stagger', 'svg', 'spring', 'animation']

/** Relative "weight" bars for the modules chapter. */
export const PART_SIZES: [string, number][] = [
  ['timer', 5.6],
  ['animation', 5.2],
  ['draggable', 6.4],
  ['scroll', 4.3],
  ['waapi', 3.5],
  ['timeline', 0.6],
  ['spring', 0.5],
  ['stagger', 0.5],
  ['svg', 0.4],
  ['scope', 0.2],
]

/** Dial arc colours, clockwise from 12 o'clock. */
export const ARC_COLORS = ['#ff4b4b', '#ff7d36', '#f9f640', '#b8ff57', '#3ee88f', '#3ee8c0', '#22d3ee', '#5b8cff']

export const BG_DARK = '#252423'
export const BG_LIGHT = '#dad5cf'
export const FG = '#ece7e0'
