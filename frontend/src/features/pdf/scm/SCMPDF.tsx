import { Document, Image, Page, View } from "@react-pdf/renderer";
import React from "react";

import { BleedEdgeMM } from "@/common/constants";
import { CardDocument } from "@/common/types";
import { getPDFImageURL, PDFImageQuality } from "@/features/pdf/pdfImage";
import {
  CARD_DISTANCE_MM,
  generateScmLayout,
  getRegistrationMarks,
  ScmLayout,
  ScmPaperSize,
  ScmRect,
  ScmRegistration,
  ScmVariant,
} from "@/features/pdf/scm/scmLayout";

// Offsets are entered in millimetres; react-pdf transforms are in points.
// (SCM's offset_pdf uses px @ 300 PPI — see scmOffsetPxToMM in scmLayout.ts to
// convert SCM calibration values to mm.)
const MM_TO_PT = 72 / 25.4;

/** SCM places cards with ~0.625mm bleed between neighbours (half of the 1.25mm
 * card distance). We show at most that much of the MPC source bleed. */
const SCM_BLEED_MM = Math.min(BleedEdgeMM, CARD_DISTANCE_MM / 2);

export interface SCMPDFProps {
  scmPaperSize: ScmPaperSize;
  scmVariant: ScmVariant;
  scmRegistration: ScmRegistration;
  scmDuplex: boolean;
  /** Back-page calibration offsets in millimetres. */
  scmOffsetXMM: number;
  scmOffsetYMM: number;
  scmOffsetAngleDeg: number;
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument };
  projectMembers: Array<{
    front: { selectedImage?: string } | null;
    back: { selectedImage?: string } | null;
  }>;
  projectCardback: string | undefined;
  imageQuality: PDFImageQuality;
  imageDPI: number | undefined;
  jpgQuality: number;
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

interface CardPair {
  front: CardDocument;
  back: CardDocument | undefined;
}

const chunk = <T,>(arr: Array<T>, size: number): Array<Array<T>> => {
  const result: Array<Array<T>> = [];
  for (let i = 0; i < arr.length; i += size)
    result.push(arr.slice(i, i + size));
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// A single card image clipped to its slot, with a sliver of bleed overflowing
// into the inter-card gap. MPC source images already contain BleedEdgeMM of
// bleed around the 63x88 trim; we clip to show only SCM_BLEED_MM of it.
// ─────────────────────────────────────────────────────────────────────────────

const SCMCard = ({
  cardDocument,
  x,
  y,
  cardWidthMM,
  cardHeightMM,
  rotate180,
  imageQuality,
  imageDPI,
  jpgQuality,
  fileHandles,
}: {
  cardDocument: CardDocument;
  x: number;
  y: number;
  cardWidthMM: number;
  cardHeightMM: number;
  rotate180: boolean;
  imageQuality: PDFImageQuality;
  imageDPI: number | undefined;
  jpgQuality: number;
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}) => {
  const boxW = cardWidthMM + 2 * SCM_BLEED_MM;
  const boxH = cardHeightMM + 2 * SCM_BLEED_MM;
  // The full source image (trim + BleedEdgeMM bleed) is positioned so its trim
  // aligns with the slot; the excess bleed overflows and is clipped by the box.
  const imgLeft = SCM_BLEED_MM - BleedEdgeMM;
  const imgTop = SCM_BLEED_MM - BleedEdgeMM;
  const imgW = cardWidthMM + 2 * BleedEdgeMM;
  const imgH = cardHeightMM + 2 * BleedEdgeMM;

  return (
    <View
      style={{
        position: "absolute" as const,
        left: x - SCM_BLEED_MM + "mm",
        top: y - SCM_BLEED_MM + "mm",
        width: boxW + "mm",
        height: boxH + "mm",
        overflow: "hidden",
      }}
    >
      <Image
        src={async () =>
          getPDFImageURL(
            cardDocument,
            imageQuality,
            imageDPI,
            jpgQuality,
            fileHandles
          )
        }
        style={
          {
            position: "absolute" as const,
            left: imgLeft + "mm",
            top: imgTop + "mm",
            width: imgW + "mm",
            height: imgH + "mm",
            ...(rotate180 ? { transform: "rotate(180deg)" } : {}),
          } as const
        }
      />
    </View>
  );
};

const Mark = ({ rect }: { rect: ScmRect }) => (
  <View
    style={{
      position: "absolute" as const,
      left: rect.x + "mm",
      top: rect.y + "mm",
      width: rect.w + "mm",
      height: rect.h + "mm",
      backgroundColor: "black",
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// One page of content (registration marks + cards) in the un-rotated oriented
// coordinate space. Fronts go in reading order; backs are mirrored per SCM's
// duplex flip (mirror rows + rotate 180 for landscape, mirror cols for portrait)
// so cuts align after flipping the sheet along its long edge.
// ─────────────────────────────────────────────────────────────────────────────

const PageContent = ({
  layout,
  registration,
  cards,
  isBack,
  imageProps,
}: {
  layout: ScmLayout;
  registration: ScmRegistration;
  cards: CardPair[];
  isBack: boolean;
  imageProps: {
    imageQuality: PDFImageQuality;
    imageDPI: number | undefined;
    jpgQuality: number;
    fileHandles: { [identifier: string]: FileSystemFileHandle };
  };
}) => {
  const { cols, rows, slotsMM, cardWidthMM, cardHeightMM, orientation } =
    layout;
  const marks = getRegistrationMarks(layout, registration);

  const backSlotIndex = (i: number): number => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const r = orientation === "landscape" ? rows - 1 - row : row;
    const c = orientation === "portrait" ? cols - 1 - col : col;
    return r * cols + c;
  };

  return (
    <View
      style={{
        position: "absolute" as const,
        left: 0,
        top: 0,
        width: layout.pageWidthMM + "mm",
        height: layout.pageHeightMM + "mm",
      }}
    >
      {marks.squares.map((rect, i) => (
        <Mark key={`sq-${i}`} rect={rect} />
      ))}
      {marks.lines.map((rect, i) => (
        <Mark key={`ln-${i}`} rect={rect} />
      ))}
      {cards.map((pair, i) => {
        const doc = isBack ? pair.back : pair.front;
        if (!doc) return null;
        const slot = isBack ? slotsMM[backSlotIndex(i)] : slotsMM[i];
        if (!slot) return null;
        return (
          <SCMCard
            key={`card-${i}`}
            cardDocument={doc}
            x={slot.x}
            y={slot.y}
            cardWidthMM={cardWidthMM}
            cardHeightMM={cardHeightMM}
            rotate180={isBack && orientation === "landscape"}
            {...imageProps}
          />
        );
      })}
    </View>
  );
};

export const SCMPDF = (props: SCMPDFProps) => {
  const layout = generateScmLayout(props.scmPaperSize, props.scmVariant);
  const cardsPerPage = layout.rows * layout.cols;

  // SCM always emits landscape pages; portrait layouts are rotated 90° clockwise
  // (matching PIL rotate(-90)). Rotating the whole page rotates each card's art
  // and outline together, so cut cards remain upright.
  const isPortrait = layout.orientation === "portrait";
  const pageOutWMM = isPortrait ? layout.pageHeightMM : layout.pageWidthMM;
  const pageOutHMM = isPortrait ? layout.pageWidthMM : layout.pageHeightMM;

  const docs = props.cardDocumentsByIdentifier;
  const resolve = (id?: string): CardDocument | undefined =>
    id ? docs[id] : undefined;

  const cards: CardPair[] = props.projectMembers
    .map((m): CardPair | undefined => {
      const front = resolve(m.front?.selectedImage);
      if (!front) return undefined;
      const back = resolve(m.back?.selectedImage ?? props.projectCardback);
      return { front, back };
    })
    .filter((c): c is CardPair => c !== undefined);

  const pageGroups = cards.length > 0 ? chunk(cards, cardsPerPage) : [[]];

  const imageProps = {
    imageQuality: props.imageQuality,
    imageDPI: props.imageDPI,
    jpgQuality: props.jpgQuality,
    fileHandles: props.fileHandles,
  };

  const offsetActive =
    props.scmOffsetXMM !== 0 ||
    props.scmOffsetYMM !== 0 ||
    props.scmOffsetAngleDeg !== 0;

  // Offset (back pages only): mirror SCM offset_images — shift the back-page
  // raster by (-x, +y) then rotate by the angle about the page centre. In
  // react-pdf transform space, translate is applied before rotate (CSS
  // right-to-left), matching SCM's "offset then rotate". Signs match SCM's
  // ImageChops.offset(-x, +y): translateX(-x) = left, translateY(+y) = down.
  const backTransform = offsetActive
    ? `rotate(${props.scmOffsetAngleDeg}deg) translateX(${
        -props.scmOffsetXMM * MM_TO_PT
      }) translateY(${props.scmOffsetYMM * MM_TO_PT})`
    : undefined;

  const renderPage = (
    cardsForPage: CardPair[],
    isBack: boolean,
    key: string
  ) => {
    const content = (
      <PageContent
        layout={layout}
        registration={props.scmRegistration}
        cards={cardsForPage}
        isBack={isBack}
        imageProps={imageProps}
      />
    );

    // Rotate portrait content to landscape output, centred on the page.
    const oriented = isPortrait ? (
      <View
        style={{
          position: "absolute" as const,
          left: pageOutWMM / 2 - layout.pageWidthMM / 2 + "mm",
          top: pageOutHMM / 2 - layout.pageHeightMM / 2 + "mm",
          width: layout.pageWidthMM + "mm",
          height: layout.pageHeightMM + "mm",
          transform: "rotate(90deg)",
        }}
      >
        {content}
      </View>
    ) : (
      content
    );

    return (
      <Page
        key={key}
        size={{ width: pageOutWMM + "mm", height: pageOutHMM + "mm" }}
      >
        <View
          style={{
            position: "absolute" as const,
            left: 0,
            top: 0,
            width: pageOutWMM + "mm",
            height: pageOutHMM + "mm",
            ...(isBack && backTransform ? { transform: backTransform } : {}),
          }}
        >
          {oriented}
        </View>
      </Page>
    );
  };

  return (
    <Document pageMode="useThumbs">
      {pageGroups.flatMap((group, i) => {
        const pages = [renderPage(group, false, `front-${i}`)];
        if (props.scmDuplex) {
          pages.push(renderPage(group, true, `back-${i}`));
        }
        return pages;
      })}
    </Document>
  );
};
