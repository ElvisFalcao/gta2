// Hand-authored layout of our compressed, stylised Cape Town.
// Coordinates are in metres-ish game units. North is -Z, east is +X.
// (Real Cape Town squeezed roughly 1:8 so that the whole Mother City fits in a pocket.)

export const WORLD = { minX: -800, maxX: 820, minZ: -700, maxZ: 660, cell: 2 };

// Coastline (everything outside is the Atlantic / Table Bay).
export const LAND = [
  [820, -300], [560, -310], [420, -330], [300, -350], [270, -380], [270, -480],
  [30, -480], [10, -430], [-120, -430], [-260, -440], [-400, -420], [-470, -360],
  [-500, -280], [-525, -180], [-540, -60], [-560, 40], [-575, 130], [-590, 190],
  [-610, 260], [-605, 350], [-620, 440], [-640, 660], [820, 660],
];

// Water inside the land polygon (the V&A Waterfront marina basin).
export const WATER_HOLES = [
  [[100, -455], [180, -455], [180, -405], [100, -405]],
];

// Mountains are solid rock. profile: mesa (flat top), peak, dome.
export const MOUNTAINS = [
  { id: 'tablemountain', name: 'Table Mountain', cx: -20, cz: 420, rx: 310, rz: 120, height: 230, profile: 'mesa', topRx: 230, topRz: 70 },
  { id: 'backtable', name: 'Table Mountain', cx: 80, cz: 610, rx: 420, rz: 95, height: 190, profile: 'mesa', topRx: 330, topRz: 50 },
  { id: 'devilspeak', name: "Devil's Peak", cx: 330, cz: 390, rx: 100, rz: 100, height: 215, profile: 'peak' },
  { id: 'lionshead', name: "Lion's Head", cx: -430, cz: 80, rx: 66, rz: 66, height: 128, profile: 'lion' },
  { id: 'signalhill', name: 'Signal Hill', cx: -350, cz: -170, rx: 60, rz: 75, height: 62, profile: 'dome' },
  { id: 'apostle1', name: 'Twelve Apostles', cx: -505, cz: 475, rx: 55, rz: 55, height: 150, profile: 'peak' },
  { id: 'apostle2', name: 'Twelve Apostles', cx: -520, cz: 560, rx: 62, rz: 58, height: 178, profile: 'peak' },
  { id: 'apostle3', name: 'Twelve Apostles', cx: -440, cz: 520, rx: 60, rz: 60, height: 165, profile: 'peak' },
  { id: 'apostle4', name: 'Twelve Apostles', cx: -560, cz: 640, rx: 60, rz: 50, height: 160, profile: 'peak' },
];

export const PLATEAU = { cx: -20, cz: 420, rx: 230, rz: 70, y: 230 };

// Ground zones painted onto land.
export const ZONES = [
  // Beaches
  { type: 'sand', poly: [[-620, 182], [-576, 182], [-576, 392], [-620, 392]] },
  { type: 'sand', poly: [[-590, 50], [-551, 50], [-561, 160], [-596, 160]] },
  { type: 'sand', poly: [[-600, -40], [-532, -40], [-540, 30], [-600, 30]] },
  // Sea Point promenade lawn
  { type: 'park', poly: [[-470, -400], [-418, -356], [-463, -318], [-500, -236], [-519, -118], [-534, -20], [-560, -20], [-545, -140], [-520, -260], [-490, -350]] },
  // Green Point park
  { type: 'park', poly: [[-306, -404], [-358, -394], [-410, -352], [-398, -302], [-306, -302]] },
  // Company's Garden
  { type: 'park', poly: [[48, -142], [102, -142], [102, -88], [48, -88]] },
  // Langa soccer field
  { type: 'park', poly: [[686, 166], [754, 166], [754, 234], [686, 234]] },
  // Plazas / quays
  { type: 'plaza', poly: [[188, -260], [242, -260], [242, -229], [188, -229]] }, // Grand Parade
  { type: 'plaza', poly: [[118, -334], [172, -334], [172, -299], [118, -299]] }, // CBD taxi rank
  { type: 'plaza', poly: [[188, -184], [242, -184], [242, -158], [188, -158]] }, // police station front
  { type: 'plaza', poly: [[258, 8], [332, 8], [332, 22], [258, 22]] }, // hospital forecourt
  { type: 'plaza', poly: [[16, -480], [270, -480], [270, -398], [16, -398]] }, // Waterfront quays
  { type: 'plaza', poly: [[530, 10], [592, 10], [592, 72], [530, 72]] }, // Langa taxi rank
  { type: 'plaza', poly: [[620, 100], [662, 100], [662, 150], [620, 150]] }, // shisa nyama yard
  { type: 'plaza', poly: [[-170, -172], [-150, -172], [-150, -156], [-170, -156]] }, // Rashieda's stoep
  { type: 'plaza', poly: [[-284, -162], [-258, -162], [-258, -138], [-284, -138]] }, // Noon Gun
  { type: 'plaza', poly: [[440, -210], [510, -210], [510, -160], [440, -160]] }, // Silverleaf yard
  { type: 'plaza', poly: [[-162, 238], [-138, 238], [-138, 262], [-162, 262]] }, // cable car lower station
  { type: 'plaza', poly: [[-440, 168], [-416, 168], [-416, 192], [-440, 192]] }, // Lion's Head trailhead
];

// District names + architectural style. First match wins.
export const DISTRICTS = [
  { id: 'waterfront', name: 'V&A Waterfront', rect: [0, -500, 290, -372], style: null },
  { id: 'campsbay', name: 'Camps Bay', poly: [[-640, 175], [-470, 175], [-430, 440], [-640, 440]], style: 'villa' },
  { id: 'clifton', name: 'Clifton', poly: [[-620, -15], [-495, -15], [-480, 175], [-620, 175]], style: 'villa' },
  { id: 'kloofnek', name: 'Kloof Nek', poly: [[-480, 140], [-300, 140], [-270, 300], [-470, 300]], style: null },
  { id: 'seapoint', name: 'Sea Point', poly: [[-580, -350], [-395, -300], [-395, -15], [-580, -15]], style: 'apartment' },
  { id: 'greenpoint', name: 'Green Point', poly: [[-520, -480], [-45, -480], [-45, -296], [-395, -296]], style: 'apartment_low' },
  { id: 'longst', name: 'Long Street', rect: [12, -372, 70, -84], style: 'victorian' },
  { id: 'bokaap', name: 'Bo-Kaap', rect: [-300, -296, -46, -84], style: 'bokaap' },
  { id: 'cbd', name: 'City Centre', rect: [-46, -372, 262, -84], style: 'office' },
  { id: 'woodstock', name: 'Woodstock', rect: [262, -372, 560, -84], style: 'industrial' },
  { id: 'gardens', name: 'Gardens', rect: [-300, -84, 262, 320], style: 'house' },
  { id: 'observatory', name: 'Observatory', rect: [262, -84, 540, 320], style: 'house' },
  { id: 'langa', name: 'Langa', rect: [540, -160, 820, 340], style: 'township' },
];

export const STYLES = {
  office: { wall: 'office', h: [16, 62], size: [14, 28], gap: 2, roof: 'flat', colors: ['#9cc3e6', '#7fb2d8', '#bcd7e6', '#8fd0c0', '#e6d6b8', '#7aa0c8', '#b8d8b0', '#f0c8b0'] },
  victorian: { wall: 'house', h: [9, 15], size: [10, 16], gap: 0, roof: 'flat', colors: ['#ffc24a', '#f26b52', '#4fc2b6', '#f5e6c4', '#a8d860', '#e88fc4', '#ffe27a', '#6fb0ff'] },
  apartment: { wall: 'apartment', h: [14, 42], size: [14, 22], gap: 4, roof: 'flat', colors: ['#fff4e0', '#ffe0c8', '#d8eef6', '#e6f4d8', '#f6e0ee', '#fff0b8'] },
  apartment_low: { wall: 'apartment', h: [8, 22], size: [12, 20], gap: 4, roof: 'flat', colors: ['#fff4e0', '#ffdcc0', '#d4ecf4', '#e4f2d4', '#f8dcea'] },
  villa: { wall: 'villa', h: [5, 10], size: [10, 16], gap: 4, roof: 'flat', colors: ['#ffffff', '#fff2dc', '#f4f8ff', '#ffe8e0', '#eef8ea'] },
  bokaap: { wall: 'house', h: [6, 8], size: [6, 10], gap: 0, roof: 'flat', colors: ['#ff5fa2', '#7ed957', '#38c6d9', '#ffd23f', '#ff8c42', '#a86cf0', '#3f8efc', '#f25f5c', '#5ce1b9'] },
  house: { wall: 'house', h: [5, 9], size: [8, 14], gap: 4, roof: 'gable', colors: ['#fff0d0', '#ffd8b0', '#d8f0d0', '#ffd6c8', '#fff0a8', '#d0e8f4'] },
  industrial: { wall: 'industrial', h: [6, 14], size: [14, 28], gap: 2, roof: 'flat', colors: ['#c8603e', '#a85a44', '#b0a090', '#8c9090', '#d07a4c', '#7c8a96'] },
  township: { wall: 'township', h: [2.8, 3.4], size: [5, 8], gap: 2, roof: 'slab', colors: ['#ffe6b8', '#bfe0ff', '#ffc890', '#d4f0b0', '#ffd0e0', '#f0e0c8', '#a8e8e0'], roofColors: ['#3f6fb5', '#b8433a', '#3d8a5a', '#8f9599', '#c98b2a', '#5a5f66'] },
};

// ---------------------------------------------------------------------------
// Roads. Polylines; the graph builder auto-splits crossings and T-junctions.
// ---------------------------------------------------------------------------

function line(points, width = 10, opts = {}) {
  return { pts: points, width, sidewalk: opts.sidewalk ?? (width <= 8 ? 2 : 3), traffic: opts.traffic ?? true, name: opts.name || '' };
}
const span = (xs, z) => xs.map((x) => [x, z]);
const col = (x, zs) => zs.map((z) => [x, z]);
const lerpPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const B = {
  B0: [10, -418], B1: [-120, -418], B2: [-260, -425], B2b: [-300, -417], B3: [-360, -405], B4: [-460, -320],
  B5: [-490, -240], B6: [-510, -120], B7: [-525, -20], B8: [-540, 80], B9: [-555, 170], B10: [-570, 260], B11: [-570, 420],
};
const K1 = [-470, 240], K2 = [-340, 210], K3 = [-200, 160];

function buildRoads() {
  const R = [];
  // Beach Road / Victoria Road: the Atlantic seaboard drive.
  R.push(line([B.B0, B.B1, B.B2, B.B2b, B.B3, B.B4, B.B5, B.B6, B.B7, B.B8, B.B9, B.B10, B.B11], 12, { name: 'Beach Rd' }));
  // Main Road from Sea Point through Green Point, Bo-Kaap, City Centre and Woodstock.
  R.push(line([[-465, -30], [-455, -120], [-445, -240], [-400, -290], [-300, -290], [-260, -290], [-200, -290], [-120, -290], [-40, -290], [40, -290], [110, -290], [180, -290], [250, -290], [340, -290], [430, -290], [520, -290]], 12, { name: 'Main Rd' }));
  R.push(line([[-465, -30], B.B7], 10, { name: 'Regent Rd' }));
  R.push(line([[-445, -240], B.B5], 8, { name: 'Clarens Rd' }));
  R.push(line([[-455, -120], B.B6], 8, { name: 'Church Rd' }));
  R.push(line([B.B1, [-120, -360], [-120, -290]], 10, { name: 'Granger Bay Blvd' }));
  R.push(line([[-300, -290], B.B2b], 10, { name: 'Vlei Rd' }));

  // City Centre + Gardens grid
  const X = [-40, 40, 110, 180, 250];
  const names = { '-40': 'Buitengracht St', 40: 'Long St', 110: 'Adderley St', 180: 'Plein St', 250: 'Buitenkant St' };
  for (const x of X) R.push(line(col(x, [-360, -290, -220, -150, -80, 0, 80, 160]), x === -40 ? 12 : 10, { name: names[x] }));
  R.push(line(span(X, -360), 10, { name: 'Strand St' }));
  // Bo-Kaap little streets
  R.push(line(span([-200, -120, -40], -220), 8, { name: 'Shortmarket St' }));
  R.push(line(span([-200, -120, -40], -150), 8, { name: 'Wale St' }));
  R.push(line(span([-40, 40, 110, 180, 250, 340, 430, 520], -220), 10, { name: 'Victoria Rd' }));
  R.push(line(span([-40, 40, 110, 180, 250, 340, 430, 520], -150), 10, { name: 'Darling St' }));
  R.push(line(span([-200, -120, -40, 40, 110, 180, 250], -80), 10, { name: 'Orange St' }));
  for (const z of [0, 80, 160]) R.push(line(span([-200, -120, -40, 40, 110, 180, 250, 340, 430, 520], z), 10, { name: z === 0 ? 'Kloof St' : z === 80 ? 'Upper Orange St' : 'Upper Kloof Rd' }));
  R.push(line(col(-200, [-290, -220, -150, -80, 0, 80, 160]), 8, { name: 'Rose St' }));
  R.push(line(col(-120, [-290, -220, -150, -80, 0, 80, 160]), 8, { name: 'Chiappini St' }));
  R.push(line([[-200, -150], [-258, -150]], 8, { traffic: false, name: 'Military Rd' }));
  // Kloof Nek pass over to Camps Bay
  R.push(line([K3, K2, K1, B.B10], 10, { name: 'Kloof Nek Rd' }));
  R.push(line([[-570, 330], [-505, 330], K1], 8, { name: 'Camps Bay Dr' }));
  const trailFork = lerpPt(K2, K1, 90 / 130);
  R.push(line([trailFork, [-428, 186]], 8, { traffic: false, name: "Lion's Head Trail" }));
  R.push(line([[-120, 160], [-150, 236]], 8, { traffic: false, name: 'Tafelberg Rd' }));

  // Waterfront
  R.push(line([[10, -390], [110, -390], [250, -390]], 10, { name: 'Dock Rd' }));
  R.push(line([[-40, -360], [10, -390], B.B0], 10, { name: 'Portswood Rd' }));
  R.push(line([[110, -360], [110, -390]], 10, { name: 'Adderley St' }));
  R.push(line([[250, -360], [250, -390]], 10, { name: 'Dock Rd' }));

  // Woodstock / Observatory
  for (const x of [340, 430]) R.push(line(col(x, [-290, -220, -150, -80, 0, 80, 160]), 10, { name: x === 340 ? 'Albert Rd' : 'Sir Lowry Rd' }));
  R.push(line(col(520, [-290, -220, -150, -80, 0, 80, 160, 240]), 10, { name: 'Station Rd' }));
  // N2 highway towards Langa
  R.push(line(span([250, 340, 430, 520, 600, 680, 760], -80), 14, { name: 'N2' }));
  // Langa grid
  for (const z of [0, 80, 160]) R.push(line(span([520, 600, 680, 760], z), 8, { name: 'Washington St' }));
  R.push(line(span([520, 600, 680, 760], 240), 8, { name: 'Bunga Ave' }));
  for (const x of [600, 680, 760]) R.push(line(col(x, [-80, 0, 80, 160, 240]), 8, { name: 'Langa Main Rd' }));
  return R;
}

export const ROADS = buildRoads();

// ---------------------------------------------------------------------------
// Points of interest used by missions, activities and landmarks.
// ---------------------------------------------------------------------------
export const POI = {
  spawn: { x: -592, z: 252, h: Math.PI / 2 },
  kyle: { x: -589, z: 241, h: -Math.PI / 2 },
  lifeguardTower: { x: -597, z: 226 },
  kyleBakkie: { x: -582, z: 205, h: Math.PI },
  zanele: { x: -518, z: -152, h: Math.PI / 2 },
  gym: { x: -520, z: -168 },
  promenadeNorth: { x: -434, z: -374 },
  lighthouse: { x: -410, z: -400 },
  noma: { x: 215, z: -246, h: Math.PI },
  cityHall: { x: 215, z: -271 },
  policeStation: { x: 215, z: -165 },
  vusi: { x: 145, z: -318, h: Math.PI },
  taxiRank: { x: 145, z: -316 },
  langaRank: { x: 560, z: 40 },
  rashieda: { x: -160, z: -163, h: 0 },
  safehouse: { x: -152, z: -159 },
  mosque: { x: -82, z: -185 },
  noonGun: { x: -272, z: -150 },
  silverleafYard: { x: 475, z: -185 },
  silverleafGate: { x: 475, z: -158 },
  trailhead: { x: -428, z: 180 },
  cableLower: { x: -150, z: 250 },
  cableTop: { x: -110, z: 366 },
  pieter: { x: -60, z: 356.5, h: Math.PI },
  viewpoint: { x: -54, z: 356 },
  hospital: { x: 296, z: 15 },
  shisaNyama: { x: 640, z: 118 },
  soccerField: { x: 720, z: 200 },
  gatsby: { x: 52, z: -185 },
  fishChips: { x: 60, z: -404 },
  capeWheel: { x: 60, z: -445 },
  clockTower: { x: 140, z: -468 },
  helipad: { x: 166, z: -468 },
  castle: { x: 295, z: -255 },
  stadium: { x: -200, z: -355 },
  companyGarden: { x: 75, z: -115 },
  beachCamps: { x: -598, z: 300 },
  beachClifton: { x: -566, z: 104 },
  woodstockMural: { x: 380, z: -185 },
};

// Areas kept free of procedural buildings (circles: x, z, r).
export const RESERVED = [
  { x: -588, z: 240, r: 30 },
  { x: -82, z: -185, r: 12 },
  { x: -160, z: -165, r: 9 },
  { x: -146, z: -160, r: 5 },
  { x: -272, z: -150, r: 13 },
  { x: -428, z: 180, r: 14 },
  { x: 52, z: -185, r: 5 },
  { x: 295, z: -255, r: 34 },
  { x: -200, z: -355, r: 55 },
  { x: -410, z: -400, r: 10 },
  { x: -150, z: 250, r: 16 },
  { x: 640, z: 125, r: 22 },
  { x: 380, z: -185, r: 6 },
  // activity spots (keep trees / houses away)
  { x: -520, z: -164, r: 9 },
  { x: -598, z: 300, r: 6 },
  { x: -566, z: 104, r: 6 },
  { x: 46.5, z: -246, r: 3 },
  { x: 75, z: -143.5, r: 3 },
  { x: -100, z: -155, r: 3 },
  { x: 95, z: -397, r: 3 },
  { x: 610, z: 244, r: 3 },
  { x: 650, z: 236, r: 3 },
  { x: 700, z: 244, r: 3 },
  // billboards
  { x: 380, z: -93, r: 5 },
  { x: 600, z: -93, r: 5 },
  { x: -330, z: -276, r: 5 },
  { x: 30, z: -373, r: 5 },
];
// Rectangles reserved for hand-made landmarks [minX, minZ, maxX, maxZ].
export const RESERVED_RECTS = [
  [188, -282, 242, -229], // City Hall + Grand Parade
  [188, -212, 242, -158], // police station
  [118, -352, 172, -299], // station + taxi rank
  [258, 8, 332, 72], // hospital
  [438, -212, 512, -158], // Silverleaf yard
  [526, 6, 594, 74], // Langa taxi rank
  [686, 166, 754, 234], // soccer field
  [16, -480, 270, -398], // Waterfront quays
];

// Off-road spots where parked cars appear.
export const PARKING = [
  { x: -582, z: 205, h: Math.PI, type: 'bakkie', id: 'kyleBakkie' },
  { x: -586, z: 316, h: 0.2, type: 'hatch' },
  { x: -588, z: 120, h: 0.1, type: 'sedan' },
  { x: -436, z: -365, h: 2.4, type: 'hatch' },
  { x: 128, z: -322, h: Math.PI / 2, type: 'minibus' },
  { x: 128, z: -310, h: Math.PI / 2, type: 'minibus' },
  { x: 162, z: -310, h: -Math.PI / 2, type: 'minibus' },
  { x: 200, z: -168, h: 0, type: 'police' },
  { x: 230, z: -168, h: 0, type: 'police' },
  { x: 270, z: 14, h: Math.PI / 2, type: 'sedan' },
  { x: 40, z: -412, h: Math.PI / 2, type: 'sedan' },
  { x: 230, z: -398 + -2, h: -Math.PI / 2, type: 'sports' },
  { x: 540, z: 20, h: 0, type: 'minibus' },
  { x: 540, z: 36, h: 0, type: 'minibus' },
  { x: 580, z: 60, h: Math.PI, type: 'minibus' },
  { x: 630, z: 145, h: Math.PI / 2, type: 'bakkie' },
  { x: -150, z: 244, h: 0, type: 'hatch' },
  { x: -436, z: 186, h: 0, type: 'bakkie' },
  { x: 200, z: -236, h: Math.PI / 2, type: 'sedan' },
];

// Hidden protea flowers (collectibles).
export const PROTEAS = [
  [-604, 330], [-570, 70], [-528, -70], [-446, -386], [80, -120], [-268, -142], [-424, 176],
  [-140, 256], [140, -476], [330, -185], [500, -100], [722, 214], [650, 248], [300, 150],
  [-20, 420, 230],
];
