// Lion Brand Wool-Ease Thick & Quick (product 640) shades.
// Hex values are screen approximations of each shade, not official values.
// Shades with more than one hex are multis/heathers/tweeds: the first hex is
// the base and the rest are flecks. `fleck` is the share of flecked spots
// (default 0.5); tweeds use a low value.
// Edit a color's hex in the app to match your actual skein.
window.YARN = {
  name: 'Wool-Ease Thick & Quick',
  brand: 'Lion Brand',
  weight: 'Super Bulky (6)',
  fiber: '80% Acrylic, 20% Wool',
  skeinOz: 6,
  skeinYards: 106,
  // Label crochet gauge: 6 sc x 8 rows = 4" on a 9 mm (N/13) hook
  gauge: { sts: 6, rows: 8, inches: 4, hookMm: 9 },
};

// `pack: true` marks the 28 shades in Michaels' 15-pack (item MP518757),
// in the order Michaels lists them. Their colors were sampled from the
// Michaels swatch photos; Grass, Oatmeal, Navy, Metropolis, Mustard and
// Denim were hidden in that capture and are estimates.
window.CATALOG = [
  { pack: true, code: '',    name: 'Peanut',      hex: ['#ae9368'] },
  { pack: true, code: '',    name: 'River Run',   hex: ['#252c41', '#8e97b0', '#d6dbe6'], fleck: 0.2 },
  { pack: true, code: '148', name: 'Slate',       hex: ['#737d86'] },
  { pack: true, code: '108', name: 'Air Force',   hex: ['#a1b9c8'] },
  { pack: true, code: '',    name: 'Spice',       hex: ['#a02f20'] },
  { pack: true, code: '109', name: 'Petrol Blue', hex: ['#0e2538'] },
  { pack: true, code: '116', name: 'Succulent',   hex: ['#80a59e'] },
  { pack: true, code: '103', name: 'Blossom',     hex: ['#e2bec4'] },
  { pack: true, code: '',    name: 'Wheat',       hex: ['#efebe1', '#b9a27c', '#7a6a55'], fleck: 0.08 },
  { pack: true, code: '172', name: 'Kale',        hex: ['#3c5243', '#c76a7a', '#d8c9a8'], fleck: 0.08 },
  { pack: true, code: '',    name: 'Cranberry',   hex: ['#701b10'] },
  { pack: true, code: '',    name: 'Claret',      hex: ['#7a3436', '#a9424d', '#3a1a1a', '#d9c8b0'], fleck: 0.15 },
  { pack: true, code: '149', name: 'Charcoal',    hex: ['#36373a', '#8a8b8f', '#1d1d21'], fleck: 0.3 },
  { pack: true, code: '',    name: 'Pumpkin',     hex: ['#cd4d1d'] },
  { pack: true, code: '',    name: 'Abalone',     hex: ['#52505f', '#2f6f80', '#8a6a8e', '#b07a90', '#9a98a5'], fleck: 0.45 },
  { pack: true, code: '',    name: 'Grey Marble', hex: ['#d3d0c9', '#2b2928', '#7a6a5a'], fleck: 0.1 },
  { pack: true, code: '124', name: 'Barley',      hex: ['#7e6862', '#d08a4a', '#3d2824', '#e8e0d4'], fleck: 0.1 },
  { pack: true, code: '099', name: 'Fisherman',   hex: ['#e8e0d4'] },
  { pack: true, code: '144', name: 'Raisin',      hex: ['#3d2739', '#c9b48e', '#161214', '#ebe3d4'], fleck: 0.08 },
  { pack: true, code: '146', name: 'Fig',         hex: ['#984268'] },
  { pack: true, code: '',    name: 'Raspberry',   hex: ['#d05571'] },
  { pack: true, code: '153', name: 'Black',       hex: ['#2b2a2a'] },
  { pack: true, code: '',    name: 'Grass',       hex: ['#5f8f3e'] },
  { pack: true, code: '123', name: 'Oatmeal',     hex: ['#d7c8ad', '#cbb99a'] },
  { pack: true, code: '110', name: 'Navy',        hex: ['#262f4e'] },
  { pack: true, code: '',    name: 'Metropolis',  hex: ['#6b6b6b', '#1f1f1f', '#d8d8d8'], fleck: 0.45 },
  { pack: true, code: '158', name: 'Mustard',     hex: ['#c9962b'] },
  { pack: true, code: '',    name: 'Denim',       hex: ['#4e6b8e', '#5d7a9c'] },
  // Other Thick & Quick shades (not in the Michaels pack)
  { code: '102', name: 'Rouge',       hex: ['#b03b4a'] },
  { code: '105', name: 'Glacier',     hex: ['#bad3de'] },
  { code: '151', name: 'Graphite',    hex: ['#6e6f72'] },
  { code: '155', name: 'Obsidian',    hex: ['#2c2e34', '#3a3c44'] },
  { code: '141', name: 'Eggplant',    hex: ['#4a2c46'] },
  { code: '178', name: 'Cilantro',    hex: ['#6d8b3b'] },
  { code: '',    name: 'Marsh',       hex: ['#7b7e5d'] },
  { code: '',    name: 'Butterscotch',hex: ['#d1892f'] },
  { code: '',    name: 'Driftwood',   hex: ['#a69c8c', '#8d8476'] },
  { code: '',    name: 'Moonlight',   hex: ['#bfc5cc'] },
  { code: '',    name: 'Hudson Bay',  hex: ['#efe6d2', '#b8322f', '#e3b23c', '#2f6b45'] },
  { code: '',    name: 'Carousel',    hex: ['#f2ede4', '#d9c3a3', '#e2508a', '#8fd3d1', '#ef7b56'] },
];
