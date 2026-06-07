import {
  generateScmLayout,
  getRegistrationMarks,
  ScmPaperSize,
  scmTemplateName,
  ScmVariant,
} from "@/features/pdf/scm/scmLayout";

// Expected grids come straight from SCM's own assets/layouts.json
// (layouts[paper][standard][variant].num_rows / num_cols). Reproducing them
// proves our port of page_manager.generate_layout is faithful.
const EXPECTED: {
  paper: ScmPaperSize;
  variant: ScmVariant;
  rows: number;
  cols: number;
}[] = [
  { paper: "letter", variant: "default", rows: 2, cols: 4 },
  { paper: "letter", variant: "borderless", rows: 3, cols: 3 },
  { paper: "tabloid", variant: "default", rows: 4, cols: 4 },
  { paper: "tabloid", variant: "borderless", rows: 3, cols: 6 },
  { paper: "a4", variant: "default", rows: 2, cols: 4 },
  { paper: "a4", variant: "borderless", rows: 3, cols: 3 },
  { paper: "a3", variant: "default", rows: 3, cols: 6 },
  { paper: "a3", variant: "borderless", rows: 3, cols: 6 },
  { paper: "arch_b", variant: "default", rows: 3, cols: 6 },
  { paper: "arch_b", variant: "borderless", rows: 3, cols: 7 },
];

describe("generateScmLayout", () => {
  it.each(EXPECTED)(
    "computes the SCM grid for $paper/$variant ($rows x $cols)",
    ({ paper, variant, rows, cols }) => {
      const layout = generateScmLayout(paper, variant);
      expect({ rows: layout.rows, cols: layout.cols }).toEqual({ rows, cols });
      expect(layout.slotsMM).toHaveLength(rows * cols);
    }
  );

  it("places slots within the page bounds and outside the corner inset", () => {
    const layout = generateScmLayout("letter", "default");
    for (const slot of layout.slotsMM) {
      expect(slot.x).toBeGreaterThanOrEqual(layout.insetMM);
      expect(slot.y).toBeGreaterThanOrEqual(layout.insetMM);
      expect(slot.x + layout.cardWidthMM).toBeLessThanOrEqual(
        layout.pageWidthMM - layout.insetMM
      );
      expect(slot.y + layout.cardHeightMM).toBeLessThanOrEqual(
        layout.pageHeightMM - layout.insetMM
      );
    }
  });

  it("uses landscape page dims for landscape and swapped dims for portrait", () => {
    const landscape = generateScmLayout("letter", "default");
    expect(landscape.pageWidthMM).toBeGreaterThan(landscape.pageHeightMM);
    const portrait = generateScmLayout("letter", "borderless");
    expect(portrait.pageHeightMM).toBeGreaterThan(portrait.pageWidthMM);
  });
});

describe("getRegistrationMarks", () => {
  // Geometry confirmed against SCM's real generate_reg_mark output at 300 PPI:
  // bars centred on the inset line (outer edge at inset - t/2), projecting caps
  // (arm length L + t/2, fully-filled corner), and a (5 + t)mm filled square.
  const t = 1; // REG_THICKNESS_MM
  const square = 5; // REG_SQUARE_MM

  it("3-corner has one square + two L-marks (4 strokes)", () => {
    const layout = generateScmLayout("letter", "default");
    const marks = getRegistrationMarks(layout, 3);
    const inset = layout.insetMM;
    const L = layout.registrationLengthMM;

    expect(marks.squares).toHaveLength(1);
    expect(marks.lines).toHaveLength(4);

    // Square: (5 + t)mm, top-left at inset - t/2.
    expect(marks.squares[0]).toEqual({
      x: inset - t / 2,
      y: inset - t / 2,
      w: square + t,
      h: square + t,
    });

    // Top-right L is one of the two L-marks. Its arms must share a filled corner
    // (both reach the outer tip) and be L + t/2 long, t thick.
    const W = layout.pageWidthMM;
    const cx = W - inset;
    // horizontal arm extends inward (left); outer cap projects to cx + t/2.
    expect(marks.lines).toContainEqual({
      x: cx - L,
      y: inset - t / 2,
      w: L + t / 2,
      h: t,
    });
    // vertical arm centred on cx, extends down; outer cap projects up to inset - t/2.
    expect(marks.lines).toContainEqual({
      x: cx - t / 2,
      y: inset - t / 2,
      w: t,
      h: L + t / 2,
    });
  });

  it("4-corner has no square + four L-marks (8 strokes)", () => {
    const layout = generateScmLayout("letter", "default");
    const marks = getRegistrationMarks(layout, 4);
    const inset = layout.insetMM;
    const L = layout.registrationLengthMM;

    expect(marks.squares).toHaveLength(0);
    expect(marks.lines).toHaveLength(8);

    // Top-left L: both arms start at the outer tip (inset - t/2, inset - t/2),
    // so the corner is fully filled (no notch).
    expect(marks.lines).toContainEqual({
      x: inset - t / 2,
      y: inset - t / 2,
      w: L + t / 2,
      h: t,
    });
    expect(marks.lines).toContainEqual({
      x: inset - t / 2,
      y: inset - t / 2,
      w: t,
      h: L + t / 2,
    });
  });
});

describe("scmTemplateName", () => {
  it("omits 'default' and includes version", () => {
    expect(scmTemplateName("letter", "default")).toBe("letter-standard-v6");
  });
  it("includes the borderless variant", () => {
    expect(scmTemplateName("a4", "borderless")).toBe(
      "a4-standard-borderless-v2"
    );
  });
});
