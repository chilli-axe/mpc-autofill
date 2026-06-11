/**
 * Faithful TypeScript port of silhouette-card-maker's (SCM) layout geometry.
 *
 * The cut positions in SCM's official Silhouette Studio templates (.studio3) are
 * fixed, so this mode must reproduce SCM's card-grid and registration-mark
 * positions exactly. We replicate the upstream math (size_convert.py,
 * page_manager.py, the relevant parts of utilities.py / layouts.json) including
 * the integer-pixel rounding at 300 PPI, then convert pixels -> millimetres for
 * react-pdf via `pxToMM`.
 *
 * Upstream reference: https://github.com/Alan-Cha/silhouette-card-maker
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants (mirrors layouts.json defaults + page_manager.py)
// ─────────────────────────────────────────────────────────────────────────────

/** SCM computes every layout at this baseline resolution. */
export const SCM_PPI = 300;

/** Card "distance" / spacing between cards. Equivalent to ~0.625mm bleed/edge. */
export const CARD_DISTANCE_MM = 1.25;

/** Inset (paper edge -> registration marks). */
export const DEFAULT_INSET_MM = 10;
export const BORDERLESS_INSET_MM = 3.5;

/** Corner exclusion zone = default reg length (5mm) + REG_PADDING (1.5mm). */
export const CORNER_EXCLUSION_MM = 6.5;

/** Registration mark line thickness. */
export const REG_THICKNESS_MM = 1;

/** Filled black registration square (3-corner pattern, top-left). */
export const REG_SQUARE_MM = 5;

/** Registration mark length is clamped to this range by page_manager.py. */
export const MIN_REG_LENGTH_MM = 5;
export const MAX_REG_LENGTH_MM = 20;

/** Silhouette Studio enforces a 10mm minimum inset; borderless gets around this
 * by declaring a larger paper size. Each paper dimension grows by this much. */
export const BORDERLESS_STUDIO_EXPANSION_MM =
  (DEFAULT_INSET_MM - BORDERLESS_INSET_MM) * 2; // 13mm

/** Standard card (a.k.a. euro_poker) — the only card size this mode supports.
 * Matches MPC's CardWidthMM / CardHeightMM. */
export const SCM_CARD_WIDTH_MM = 63;
export const SCM_CARD_HEIGHT_MM = 88;

// ─────────────────────────────────────────────────────────────────────────────
// Paper sizes — stored landscape (width >= height), in mm, like layouts.json.
// ─────────────────────────────────────────────────────────────────────────────

export const ScmPaperSize = {
  letter: "letter",
  tabloid: "tabloid",
  a4: "a4",
  a3: "a3",
  arch_b: "arch_b",
} as const;
export type ScmPaperSize = keyof typeof ScmPaperSize;

export const ScmPaperLabels: { [k in ScmPaperSize]: string } = {
  letter: 'Letter (8.5 × 11")',
  tabloid: 'Tabloid (11 × 17")',
  a4: "A4 (210 × 297mm)",
  a3: "A3 (297 × 420mm)",
  arch_b: 'Arch B (12 × 18")',
};

const IN_MM = 25.4;

/** Landscape paper dimensions in mm: [width, height] with width >= height. */
export const SCM_PAPER_MM: { [k in ScmPaperSize]: [number, number] } = {
  letter: [11 * IN_MM, 8.5 * IN_MM], // 279.4 x 215.9
  tabloid: [17 * IN_MM, 11 * IN_MM], // 431.8 x 279.4
  a4: [297, 210],
  a3: [420, 297],
  arch_b: [18 * IN_MM, 12 * IN_MM], // 457.2 x 304.8
};

export const ScmVariant = {
  default: "default",
  borderless: "borderless",
} as const;
export type ScmVariant = keyof typeof ScmVariant;

export type ScmOrientation = "portrait" | "landscape";

/** Registration pattern: 3-corner (default) or 4-corner (Cameo 5 Alpha). */
export type ScmRegistration = 3 | 4;

// ─────────────────────────────────────────────────────────────────────────────
// Standard-card layout table (subset of layouts.json -> layouts[paper][standard]).
// `version` selects which .studio3 cutting template the user must load.
// `regLength` is the displayed L-mark length (clamped to [5,20]).
// ─────────────────────────────────────────────────────────────────────────────

export interface ScmLayoutEntry {
  orientation: ScmOrientation;
  version: number;
  regLengthMM: number;
}

export const SCM_STANDARD_LAYOUTS: {
  [paper in ScmPaperSize]: { [variant in ScmVariant]: ScmLayoutEntry };
} = {
  letter: {
    default: { orientation: "landscape", version: 6, regLengthMM: 8.04 },
    borderless: { orientation: "portrait", version: 2, regLengthMM: 7.45 },
  },
  tabloid: {
    default: { orientation: "portrait", version: 5, regLengthMM: 26.84 },
    borderless: { orientation: "landscape", version: 2, regLengthMM: 18.97 },
  },
  a4: {
    default: { orientation: "landscape", version: 5, regLengthMM: 9.4 },
    borderless: { orientation: "portrait", version: 2, regLengthMM: 10.5 },
  },
  a3: {
    default: { orientation: "landscape", version: 5, regLengthMM: 6.6 },
    borderless: { orientation: "landscape", version: 2, regLengthMM: 13.63 },
  },
  arch_b: {
    default: { orientation: "landscape", version: 4, regLengthMM: 25.15 },
    borderless: { orientation: "landscape", version: 2, regLengthMM: 14.9 },
  },
};

/** Compose SCM's template name: which .studio3 cutting file to load. */
export const scmTemplateName = (
  paper: ScmPaperSize,
  variant: ScmVariant
): string => {
  const { version } = SCM_STANDARD_LAYOUTS[paper][variant];
  return variant === "default"
    ? `${paper}-standard-v${version}`
    : `${paper}-standard-${variant}-v${version}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Unit conversion (mirrors size_convert.py, with Python-style banker's rounding)
// ─────────────────────────────────────────────────────────────────────────────

/** Python's round() uses round-half-to-even. JS Math.round rounds half up.
 * Replicate banker's rounding so pixel math matches SCM exactly. */
export const pyRound = (value: number): number => {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly .5 -> round to even.
  return floor % 2 === 0 ? floor : floor + 1;
};

/** mm -> integer pixels at the given ppi (size_convert.size_to_pixel). */
export const mmToPixel = (mm: number, ppi: number = SCM_PPI): number =>
  pyRound((mm / IN_MM) * ppi);

/** integer pixels -> mm (used to feed react-pdf, which works in mm). */
export const pxToMM = (px: number, ppi: number = SCM_PPI): number =>
  (px * IN_MM) / ppi;

// ─────────────────────────────────────────────────────────────────────────────
// SCM calibration-offset conversion helpers.
//
// SCM's offset_pdf / offset_images express the back-page X/Y calibration offset
// in PIXELS at the 300-PPI baseline (integer values). Our UI takes the offset in
// millimetres, so these convert between the two for users porting SCM values.
// ─────────────────────────────────────────────────────────────────────────────

/** Convert an SCM offset value (px @ 300 PPI) to millimetres. */
export const scmOffsetPxToMM = (px: number): number => pxToMM(px);

/** Convert a millimetre offset to the equivalent SCM offset value (px @ 300 PPI). */
export const scmOffsetMMToPx = (mm: number): number => mmToPixel(mm);

// ─────────────────────────────────────────────────────────────────────────────
// Layout computation (mirrors page_manager.py)
// ─────────────────────────────────────────────────────────────────────────────

/** page_manager.normalize_page_size — portrait swaps page dims; cards never swap. */
const normalizePageSize = (
  orientation: ScmOrientation,
  w: number,
  h: number
): [number, number] => (orientation === "portrait" ? [h, w] : [w, h]);

/** page_manager.compute_grid_fit */
const computeGridFit = (
  usable: number,
  card: number,
  bleed: number
): number => {
  if (usable <= 0) return 0;
  return Math.max(0, Math.floor((usable + bleed) / (card + bleed)));
};

interface MarginResult {
  cols: number;
  rows: number;
  marginX: number;
  marginY: number;
  usableW: number;
  usableH: number;
}

/** page_manager.select_best_margins — strict corner-exclusion rule. */
const selectBestMargins = (
  pageW: number,
  pageH: number,
  cardW: number,
  cardH: number,
  bleed: number,
  inset: number,
  cornerLen: number
): MarginResult => {
  const strategies: [number, number][] = [
    [inset, inset],
    [inset + cornerLen, inset],
    [inset, inset + cornerLen],
  ];

  let best: MarginResult | null = null;
  let bestCount = 0;

  const recordIfValid = (
    cols: number,
    rows: number,
    marginX: number,
    marginY: number,
    usableW: number,
    usableH: number
  ) => {
    if (cols <= 0 || rows <= 0) return;
    const gridWidth = cols * cardW + (cols + 1) * bleed;
    const gridHeight = rows * cardH + (rows + 1) * bleed;
    const gapX = marginX + (usableW - gridWidth) / 2 - inset;
    const gapY = marginY + (usableH - gridHeight) / 2 - inset;
    if (gapX < cornerLen && gapY < cornerLen) return;
    const count = cols * rows;
    if (count > bestCount) {
      bestCount = count;
      best = { cols, rows, marginX, marginY, usableW, usableH };
    }
  };

  for (const [marginX, marginY] of strategies) {
    const usableW = pageW - 2 * marginX;
    const usableH = pageH - 2 * marginY;

    const maxCols = computeGridFit(usableW, cardW, bleed);
    const maxRows = computeGridFit(usableH, cardH, bleed);

    if (maxCols === 0 || maxRows === 0) continue;

    recordIfValid(maxCols, maxRows, marginX, marginY, usableW, usableH);

    const colsClear = Math.max(
      0,
      Math.floor(
        (usableW - bleed - 2 * (cornerLen - marginX + inset)) / (cardW + bleed)
      )
    );
    const rowsClear = Math.max(
      0,
      Math.floor(
        (usableH - bleed - 2 * (cornerLen - marginY + inset)) / (cardH + bleed)
      )
    );
    recordIfValid(colsClear, maxRows, marginX, marginY, usableW, usableH);
    recordIfValid(maxCols, rowsClear, marginX, marginY, usableW, usableH);
  }

  if (best === null) {
    throw new Error(
      "No valid SCM layout fits without intruding into corner exclusion zones."
    );
  }
  return best;
};

/** page_manager.compute_card_positions — centre the grid in the usable area. */
const computeCardPositions = (
  cols: number,
  rows: number,
  cardW: number,
  cardH: number,
  bleed: number,
  marginX: number,
  marginY: number,
  usableW: number,
  usableH: number
): { xPos: number[]; yPos: number[] } => {
  const gridWidth = cols * cardW + (cols + 1) * bleed;
  const gridHeight = rows * cardH + (rows + 1) * bleed;

  const startX = pyRound(marginX + (usableW - gridWidth) / 2 + bleed);
  const startY = pyRound(marginY + (usableH - gridHeight) / 2 + bleed);

  const xPos = Array.from(
    { length: cols },
    (_, i) => startX + i * (cardW + bleed)
  );
  const yPos = Array.from(
    { length: rows },
    (_, j) => startY + j * (cardH + bleed)
  );

  return { xPos, yPos };
};

export interface ScmLayout {
  /** Oriented page size in mm (NOT yet rotated to landscape output). */
  pageWidthMM: number;
  pageHeightMM: number;
  orientation: ScmOrientation;
  cols: number;
  rows: number;
  /** Card slot size (trim) in mm — always upright 63 x 88. */
  cardWidthMM: number;
  cardHeightMM: number;
  /** Top-left of each card slot, mm, in reading order (row-major). */
  slotsMM: { x: number; y: number }[];
  insetMM: number;
  variant: ScmVariant;
  registrationLengthMM: number;
}

/**
 * Compute the full SCM layout for a standard card on the given paper/variant.
 * Pixel math is done at SCM_PPI then converted to mm.
 */
export const generateScmLayout = (
  paper: ScmPaperSize,
  variant: ScmVariant
): ScmLayout => {
  const entry = SCM_STANDARD_LAYOUTS[paper][variant];
  const orientation = entry.orientation;
  const insetMM =
    variant === "borderless" ? BORDERLESS_INSET_MM : DEFAULT_INSET_MM;

  const [paperWLandscapeMM, paperHLandscapeMM] = SCM_PAPER_MM[paper];

  // Convert to integer pixels (matches generate_layout).
  let pageWpx = mmToPixel(paperWLandscapeMM);
  let pageHpx = mmToPixel(paperHLandscapeMM);
  const cardWpx = mmToPixel(SCM_CARD_WIDTH_MM);
  const cardHpx = mmToPixel(SCM_CARD_HEIGHT_MM);
  const bleedPx = mmToPixel(CARD_DISTANCE_MM);
  const insetPx = mmToPixel(insetMM);
  const cornerPx = mmToPixel(CORNER_EXCLUSION_MM);

  [pageWpx, pageHpx] = normalizePageSize(orientation, pageWpx, pageHpx);

  const { cols, rows, marginX, marginY, usableW, usableH } = selectBestMargins(
    pageWpx,
    pageHpx,
    cardWpx,
    cardHpx,
    bleedPx,
    insetPx,
    cornerPx
  );

  const { xPos, yPos } = computeCardPositions(
    cols,
    rows,
    cardWpx,
    cardHpx,
    bleedPx,
    marginX,
    marginY,
    usableW,
    usableH
  );

  const slotsMM: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slotsMM.push({ x: pxToMM(xPos[c]), y: pxToMM(yPos[r]) });
    }
  }

  const clampedRegLength = Math.max(
    MIN_REG_LENGTH_MM,
    Math.min(entry.regLengthMM, MAX_REG_LENGTH_MM)
  );

  return {
    pageWidthMM: pxToMM(pageWpx),
    pageHeightMM: pxToMM(pageHpx),
    orientation,
    cols,
    rows,
    cardWidthMM: pxToMM(cardWpx),
    cardHeightMM: pxToMM(cardHpx),
    slotsMM,
    insetMM,
    variant,
    registrationLengthMM: clampedRegLength,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Registration marks (mirrors page_manager.generate_reg_mark)
//
// Returned in top-left-origin mm, relative to the (un-rotated) oriented page.
// matplotlib uses a bottom-left origin upstream; here everything is converted to
// react-pdf's top-left origin.
//
// Geometry verified by running SCM's real generate_reg_mark at 300 PPI:
//   - L-arm bars are CENTRED on the inset line (centreline at `inset`), so their
//     outer edge sits at `inset - t/2`, not at `inset`.
//   - matplotlib Line2D uses *projecting* caps (extend t/2 past each endpoint),
//     so the two arms form a fully-filled square corner and each arm's total
//     length is `L + t/2` (centreline `L - t/2` + a t/2 cap at each end).
//   - The 3-corner filled square is drawn 5mm with a 1mm centred border, giving
//     an effective `(5 + t) = 6mm` square whose top-left is at `inset - t/2`.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScmRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScmRegistrationMarks {
  /** Filled squares (3-corner pattern has one at the top-left). */
  squares: ScmRect[];
  /** L-arm strokes (horizontal + vertical bars). */
  lines: ScmRect[];
}

/** Build the registration marks for a layout in top-left-origin mm. */
export const getRegistrationMarks = (
  layout: ScmLayout,
  registration: ScmRegistration
): ScmRegistrationMarks => {
  const { pageWidthMM: W, pageHeightMM: H, insetMM: inset } = layout;
  const t = REG_THICKNESS_MM;
  const half = t / 2;
  const L = layout.registrationLengthMM;

  const squares: ScmRect[] = [];
  const lines: ScmRect[] = [];

  // Horizontal arm from an inner corner (cx, cy) extending inward by sx (+1/-1).
  // Centred on y = cy; spans the inset line outward by t/2 (projecting cap) and
  // inward to cy + sx*L, for a total length of L + t/2.
  const hArm = (cx: number, cy: number, sx: 1 | -1): ScmRect => ({
    x: sx === 1 ? cx - half : cx - L,
    y: cy - half,
    w: L + half,
    h: t,
  });
  // Vertical arm from an inner corner (cx, cy) extending inward by sy (+1/-1).
  const vArm = (cx: number, cy: number, sy: 1 | -1): ScmRect => ({
    x: cx - half,
    y: sy === 1 ? cy - half : cy - L,
    w: t,
    h: L + half,
  });

  const corners = {
    topLeft: { x: inset, y: inset, hDir: 1 as const, vDir: 1 as const },
    topRight: { x: W - inset, y: inset, hDir: -1 as const, vDir: 1 as const },
    bottomLeft: { x: inset, y: H - inset, hDir: 1 as const, vDir: -1 as const },
    bottomRight: {
      x: W - inset,
      y: H - inset,
      hDir: -1 as const,
      vDir: -1 as const,
    },
  };

  const addL = (c: { x: number; y: number; hDir: 1 | -1; vDir: 1 | -1 }) => {
    lines.push(hArm(c.x, c.y, c.hDir));
    lines.push(vArm(c.x, c.y, c.vDir));
  };

  if (registration === 3) {
    // Top-left filled square: 5mm fill + 1mm centred border = (5 + t)mm square
    // whose top-left sits at (inset - t/2), centred on the inset corner point.
    squares.push({
      x: inset - half,
      y: inset - half,
      w: REG_SQUARE_MM + t,
      h: REG_SQUARE_MM + t,
    });
    addL(corners.bottomLeft);
    addL(corners.topRight);
  } else {
    addL(corners.topLeft);
    addL(corners.topRight);
    addL(corners.bottomLeft);
    addL(corners.bottomRight);
  }

  return { squares, lines };
};
