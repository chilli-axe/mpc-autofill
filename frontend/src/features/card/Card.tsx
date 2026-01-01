/**
 * This component is a fundamental UI building block for displaying cards.
 * Displays a card's image, some extra information (its name, its source's name, and its DPI),
 * and has optional props for extending the component to include extra functionality.
 * If being used in a gallery, the previous and next images can be cached for visual smoothness.
 */

import styled from "@emotion/styled";
import { OnLoadingComplete } from "next/dist/shared/lib/get-img-props";
import Image from "next/image";
import React, {
  memo,
  PropsWithChildren,
  ReactElement,
  Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import BSCard from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";

import { SearchQuery, useAppDispatch, useAppSelector } from "@/common/types";
import { CardDocument } from "@/common/types";
import { Spinner } from "@/components/Spinner";
import { selectCardDocumentByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { showCardDetailedViewModal } from "@/store/slices/modalsSlice";
import { RootState } from "@/store/store";

import { useLocalFilesContext } from "../localFiles/localFilesContext";

const HiddenImage = styled(Image)`
  z-index: 0;
  opacity: 0;
`;

const VisibleImage = styled(Image)<{
  imageIsLoading?: boolean;
  showDetailedViewOnClick?: boolean;
  zIndex?: number;
}>`
  z-index: ${(props) => props.zIndex ?? 1};
  &:hover {
    cursor: ${(props) => (props.showDetailedViewOnClick ? "pointer" : "auto")};
  }
  opacity: ${(props) => (props.imageIsLoading ? 0 : 1)};
`;

const OutlinedBSCardSubtitle = styled(BSCard.Subtitle)`
  outline: solid 1px #ffffff00;
  transition: outline 0.2s ease-in-out;
  &:hover {
    outline-color: #ffffffff;
    cursor: pointer;
  }
`;

type ImageState =
  | "loading-from-bucket"
  | "loading-from-fallback"
  | "loading-from-local-file"
  | "loaded-from-bucket"
  | "loaded-from-fallback"
  | "loaded-from-local-file"
  | "errored";

export function getImageKey(
  cardDocument: CardDocument,
  small: boolean
): string {
  return `${cardDocument.identifier}-${
    small ? "small" : "large"
  }-${cardDocument.sourceType?.toLowerCase().replace(" ", "_")}`;
}

const useLocalFileImageSrc = (
  cardDocument: CardDocument,
  setImageState: (imageState: ImageState) => void
): string | undefined => {
  const { localFilesService } = useLocalFilesContext();
  const [blobURL, setBlobURL] = useState<string | undefined>(undefined);
  useEffect(() => {
    const oramaCardDocument = localFilesService.getByID(
      cardDocument?.identifier
    );
    if (oramaCardDocument !== undefined) {
      (async () => {
        setImageState("loading-from-local-file");
        const file = await oramaCardDocument.fileHandle.getFile();
        const url = URL.createObjectURL(file);
        setBlobURL(url);
      })();
    }
  }, []);
  return blobURL;
};

const useImageSrc = (
  cardDocument: CardDocument,
  small: boolean
): {
  imageSrc: string | undefined;
  onLoadingComplete: OnLoadingComplete;
  onError: React.ReactEventHandler<HTMLImageElement>;
  imageIsLoading: boolean;
  imageRef: Ref<HTMLImageElement>;
  imageState: string;
} => {
  const [imageState, setImageState] = useState<ImageState>(
    "loading-from-bucket"
  );
  const imageRef = useRef<HTMLImageElement>(null);
  const localFileImageSrc = useLocalFileImageSrc(cardDocument, setImageState);

  const imageIsLoading =
    imageState === "loading-from-bucket" ||
    imageState === "loading-from-fallback" ||
    imageState === "loaded-from-local-file";

  /**
   * Ensure that the small thumbnail fades in each time the selected image changes.
   * Next.js seems to not fire `onLoadingComplete` when opening a page with a cached image.
   * This implementation was retrieved from https://stackoverflow.com/a/59809184
   */
  useEffect(() => {
    setImageState(
      imageRef.current == null || !imageRef.current.complete
        ? "loading-from-bucket"
        : "loaded-from-bucket"
    );
  }, [cardDocument.identifier]);

  const onLoadingComplete: OnLoadingComplete = (img) => {
    if (imageState === "loading-from-bucket") {
      setImageState("loaded-from-bucket");
    } else if (imageState === "loading-from-fallback") {
      setImageState("loaded-from-fallback");
    } else if (imageState === "loading-from-local-file") {
      setImageState("loaded-from-local-file");
    }
  };
  const onError: React.ReactEventHandler<HTMLImageElement> = (img) => {
    img.preventDefault();
    img.currentTarget.onerror = null;
    setImageState((value) =>
      value === "loading-from-bucket" || value === "loaded-from-bucket"
        ? "loading-from-fallback"
        : "errored"
    );
  };

  if (localFileImageSrc !== undefined) {
    return {
      imageSrc: localFileImageSrc,
      onLoadingComplete,
      onError,
      imageIsLoading,
      imageRef,
      imageState,
    };
  }

  // attempt to load directly from bucket first
  const imageBucketURL = process.env.NEXT_PUBLIC_IMAGE_BUCKET_URL;
  // TODO: support other source types through CDN here
  const imageBucketURLValid =
    imageBucketURL != null && !!(cardDocument.sourceType === "Google Drive");

  const loadFromBucket =
    imageBucketURLValid &&
    (imageState === "loading-from-bucket" ||
      imageState === "loaded-from-bucket");
  const imageKey = getImageKey(cardDocument, small);
  const thumbnailBucketURL = `${imageBucketURL}/${imageKey}`;

  // if image is unavailable in bucket, fall back on loading from worker if possible
  const imageWorkerURL = process.env.NEXT_PUBLIC_IMAGE_WORKER_URL;
  const imageWorkerURLValid =
    imageWorkerURL != null && !!(cardDocument?.sourceType === "Google Drive");

  const smallThumbnailURL = imageWorkerURLValid
    ? `${imageWorkerURL}/images/google_drive/small/${cardDocument?.identifier}.jpg`
    : cardDocument?.smallThumbnailUrl;
  const mediumThumbnailURL = imageWorkerURLValid
    ? `${imageWorkerURL}/images/google_drive/large/${cardDocument?.identifier}.jpg`
    : cardDocument?.mediumThumbnailUrl;

  const thumbnailFallbackURL = small ? smallThumbnailURL : mediumThumbnailURL;
  const imageSrc = loadFromBucket ? thumbnailBucketURL : thumbnailFallbackURL;

  return {
    imageSrc,
    onLoadingComplete,
    onError,
    imageIsLoading,
    imageRef,
    imageState,
  };
};

interface CardImageProps {
  cardDocument: CardDocument;
  hidden: boolean;
  small: boolean;
  showDetailedViewOnClick: boolean;
}

function CardImage({
  cardDocument, // cardDocument reference *must* be stable at call site for memoization to work!
  hidden,
  small,
  showDetailedViewOnClick,
}: CardImageProps) {
  const dispatch = useAppDispatch();
  const handleShowDetailedView = () => {
    if (showDetailedViewOnClick) {
      dispatch(showCardDetailedViewModal({ card: cardDocument }));
    }
  };

  const {
    imageSrc,
    onLoadingComplete,
    onError,
    imageIsLoading,
    imageRef,
    imageState,
  } = useImageSrc(cardDocument, small);

  // if loading from fallback fails, display a 404 error image
  const errorImageSrc = small ? "/error_404.png" : "/error_404_med.png";

  // a few other computed constants
  const imageAlt = cardDocument.name ?? "Unnamed Card";
  const showSpinner = imageIsLoading && !hidden;

  //# endregion

  return (
    <>
      {showSpinner && <Spinner zIndex={2} />}
      {imageSrc != null &&
        (hidden ? (
          <HiddenImage
            ref={imageRef}
            className="card-img"
            loading="lazy"
            src={imageSrc}
            onLoadingComplete={onLoadingComplete}
            onErrorCapture={onError}
            alt={imageAlt}
            fill={true}
          />
        ) : (
          <>
            {imageState === "errored" ? (
              <VisibleImage
                ref={imageRef}
                className="card-img card-img-fade-in"
                loading="lazy"
                src={errorImageSrc}
                alt={""}
                fill={true}
              />
            ) : (
              <VisibleImage
                ref={imageRef}
                className="card-img card-img-fade-in"
                loading="lazy"
                imageIsLoading={imageIsLoading}
                showDetailedViewOnClick={showDetailedViewOnClick}
                src={imageSrc}
                onLoadingComplete={onLoadingComplete}
                onErrorCapture={onError}
                onClick={handleShowDetailedView}
                alt={imageAlt}
                fill={true}
              />
            )}
          </>
        ))}
    </>
  );
}

export const MemoizedCardImage = memo(CardImage);

interface CardProportionWrapperProps {
  small: boolean;
  bordered?: boolean;
}

const CardProportionWrapperStyle = styled.div<{ $borderWidth?: number }>`
  z-index: 0;
  background: #4e5d6c;
  border: solid ${(props) => props.$borderWidth ?? 0}px black;
`;

function CardProportionWrapper({
  small,
  bordered = false,
  children,
}: PropsWithChildren<CardProportionWrapperProps>) {
  return (
    <CardProportionWrapperStyle
      $borderWidth={bordered ? 2 : 0}
      className={`rounded-${small ? "lg" : "xl"} shadow-lg ratio ratio-7x5`}
    >
      {children}
    </CardProportionWrapperStyle>
  );
}

export const MemoizedCardProportionWrapper = memo(CardProportionWrapper);

interface CardProps {
  /** The card image identifier to display. */
  maybeCardDocument: CardDocument | undefined;
  /** If this `Card` is part of a gallery, use this prop to cache the previous image for visual smoothness. */
  maybePreviousCardDocument?: CardDocument | undefined;
  /** If this `Card` is part of a gallery, use this prop to cache the next image for visual smoothness. */
  maybeNextCardDocument?: CardDocument | undefined;
  /** The string to display in the `Card` header. */
  cardHeaderTitle: string;
  /** An element (intended for use with a series of buttons) to include in the `Card` header.  */
  cardHeaderButtons?: ReactElement;
  /** An element (e.g. prev/next buttons) to display in the card footer. If not passed, no footer will be rendered. */
  cardFooter?: ReactElement;
  /** A callback function for when the `Card` (the HTML surrounding the image) is clicked. */
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  /** A callback function for when the card name is clicked. */
  nameOnClick?: React.MouseEventHandler<HTMLElement>;
  /** The `SearchQuery` specified when searching for this card. */
  searchQuery?: SearchQuery | undefined;
  /** Whether no search results were found when searching for `searchQuery` under the configured search settings. */
  noResultsFound: boolean;
  /** Whether to highlight this card by showing a glowing border around it. */
  highlight?: boolean;
}

/**
 * This component enables displaying cards with auxiliary information in a flexible, consistent way.
 */
export function Card({
  // CardDocument references must be stable for memoization to work!
  maybeCardDocument,
  maybePreviousCardDocument,
  maybeNextCardDocument,
  cardHeaderTitle,
  cardHeaderButtons,
  cardFooter,
  cardOnClick,
  nameOnClick,
  searchQuery,
  noResultsFound,
  highlight,
}: CardProps) {
  //# region computed constants

  const cardImageElements =
    maybeCardDocument != null ? (
      <>
        {[
          maybeCardDocument,
          ...(maybePreviousCardDocument &&
          maybePreviousCardDocument?.identifier !==
            maybeCardDocument?.identifier
            ? [maybePreviousCardDocument]
            : []),
          ...(maybeNextCardDocument &&
          maybeNextCardDocument?.identifier !== maybeCardDocument?.identifier
            ? [maybeNextCardDocument]
            : []),
        ].map(
          (cardDocument) =>
            cardDocument !== undefined && (
              <MemoizedCardImage
                key={cardDocument.identifier}
                cardDocument={cardDocument}
                hidden={
                  cardDocument?.identifier !== maybeCardDocument.identifier
                }
                small={true}
                showDetailedViewOnClick={
                  cardDocument?.identifier === maybeCardDocument.identifier &&
                  cardOnClick == null
                }
              />
            )
        )}
      </>
    ) : noResultsFound ? (
      <Image
        className="card-img card-img-fade-in"
        loading="lazy"
        style={{ zIndex: 1 }}
        src="/blank.png"
        alt="Card not found"
        fill={true}
      />
    ) : (
      <Spinner />
    );

  // @ts-ignore // TODO
  const BSCardSubtitle: typeof BSCard.Subtitle =
    nameOnClick != null ? OutlinedBSCardSubtitle : BSCard.Subtitle;

  //# endregion

  return (
    <BSCard
      className={`mpccard ${highlight ? "mpccard-highlight" : "mpccard-hover"}`}
      onClick={cardOnClick}
      style={{ contentVisibility: "auto" }}
    >
      <BSCard.Header className="pb-0 text-center">
        <p className="mpccard-slot">{cardHeaderTitle}</p>
        {cardHeaderButtons}
      </BSCard.Header>
      <div>
        <MemoizedCardProportionWrapper small={true}>
          {cardImageElements}
        </MemoizedCardProportionWrapper>
        <BSCard.Body className="mb-0 text-center">
          <BSCardSubtitle className="mpccard-name" onClick={nameOnClick}>
            {maybeCardDocument != null && maybeCardDocument.name}
            {maybeCardDocument == null &&
              searchQuery != undefined &&
              searchQuery.query}
          </BSCardSubtitle>
          <div className="mpccard-spacing">
            <BSCard.Text className="mpccard-source">
              {maybeCardDocument != null &&
                `${maybeCardDocument.sourceVerbose} [${maybeCardDocument.dpi} DPI]`}
              {maybeCardDocument == null &&
                searchQuery != undefined &&
                "Your search query"}
            </BSCard.Text>
          </div>
        </BSCard.Body>
      </div>
      {cardFooter != null && (
        <BSCard.Footer
          className="padding-top"
          style={{ paddingTop: 50 + "px" }}
        >
          {cardFooter}
        </BSCard.Footer>
      )}
    </BSCard>
  );
}

export const MemoizedCard = memo(Card);

interface EditorCardProps {
  /** The card image identifier to display. */
  imageIdentifier: string | undefined;
  /** If this `Card` is part of a gallery, use this prop to cache the previous image for visual smoothness. */
  previousImageIdentifier?: string | undefined;
  /** If this `Card` is part of a gallery, use this prop to cache the next image for visual smoothness. */
  nextImageIdentifier?: string | undefined;
  /** The string to display in the `Card` header. */
  cardHeaderTitle: string;
  /** An element (intended for use with a series of buttons) to include in the `Card` header.  */
  cardHeaderButtons?: ReactElement;
  /** An element (e.g. prev/next buttons) to display in the card footer. If not passed, no footer will be rendered. */
  cardFooter?: ReactElement;
  /** A callback function for when the `Card` (the HTML surrounding the image) is clicked. */
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  /** A callback function for when the card name is clicked. */
  nameOnClick?: React.MouseEventHandler<HTMLElement>;
  /** The `SearchQuery` specified when searching for this card. */
  searchQuery?: SearchQuery | undefined;
  /** Whether no search results were found when searching for `searchQuery` under the configured search settings. */
  noResultsFound: boolean;
  /** Whether to highlight this card by showing a glowing border around it. */
  highlight?: boolean;
}

/**
 * This component is a thin layer on top of `Card` that retrieves `CardDocument` items by their identifiers
 * from the Redux store (used in the project editor).
 * We have this layer because search results are returned as a list of image identifiers
 * (to minimise the quantity of data stored in Elasticsearch), so the full `CardDocument` items must be looked up.
 */
export function EditorCard({
  imageIdentifier,
  previousImageIdentifier,
  nextImageIdentifier,
  cardHeaderTitle,
  cardHeaderButtons,
  cardFooter,
  cardOnClick,
  nameOnClick,
  searchQuery,
  noResultsFound,
  highlight,
}: EditorCardProps) {
  //# region queries and hooks

  const maybeCardDocument = useAppSelector((state: RootState) =>
    selectCardDocumentByIdentifier(state, imageIdentifier)
  );
  const maybePreviousCardDocument = useAppSelector((state: RootState) =>
    selectCardDocumentByIdentifier(state, previousImageIdentifier)
  );
  const maybeNextCardDocument = useAppSelector((state: RootState) =>
    selectCardDocumentByIdentifier(state, nextImageIdentifier)
  );

  //# endregion

  return (
    <MemoizedCard
      maybeCardDocument={maybeCardDocument}
      maybePreviousCardDocument={maybePreviousCardDocument}
      maybeNextCardDocument={maybeNextCardDocument}
      cardHeaderTitle={cardHeaderTitle}
      cardHeaderButtons={cardHeaderButtons}
      cardFooter={cardFooter}
      cardOnClick={cardOnClick}
      nameOnClick={nameOnClick}
      searchQuery={searchQuery}
      noResultsFound={noResultsFound}
      highlight={highlight}
    />
  );
}

export const MemoizedEditorCard = memo(EditorCard);

interface DatedCardProps {
  cardDocument: CardDocument;
  headerDate: "created" | "modified";
}
/**
 * This component is a thin layer on top of `Card` for use in the What's New page.
 */
export function DatedCard({
  cardDocument,
  headerDate = "created",
}: DatedCardProps) {
  return (
    <Col>
      <MemoizedCard
        key={`new-cards-${cardDocument.identifier}`}
        maybeCardDocument={cardDocument}
        cardHeaderTitle={
          headerDate === "created"
            ? cardDocument.dateCreated
            : cardDocument.dateModified
        }
        noResultsFound={false}
      />
    </Col>
  );
}
