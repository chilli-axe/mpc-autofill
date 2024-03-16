/**
 * This component is a fundamental UI building block for displaying cards.
 * Displays a card's image, some extra information (its name, its source's name, and its DPI),
 * and has optional props for extending the component to include extra functionality.
 * If being used in a gallery, the previous and next images can be cached for visual smoothness.
 */

import { OnLoadingComplete } from "next/dist/shared/lib/get-img-props";
import Image from "next/image";
import React, {
  memo,
  PropsWithChildren,
  ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import BSCard from "react-bootstrap/Card";
import styled from "styled-components";

import { RootState } from "@/app/store";
import { SearchQuery, useAppDispatch, useAppSelector } from "@/common/types";
import { CardDocument } from "@/common/types";
import { Spinner } from "@/components/spinner";
import { setSelectedCardAndShowModal } from "@/features/modals/modalsSlice";
import { selectCardDocumentByIdentifier } from "@/features/search/cardDocumentsSlice";

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

interface CardImageProps {
  maybeCardDocument: CardDocument | null;
  hidden: boolean;
  small: boolean;
  showDetailedViewOnClick: boolean;
}

function CardImage({
  maybeCardDocument,
  hidden,
  small,
  showDetailedViewOnClick,
}: CardImageProps) {
  //# region queries and hooks

  const dispatch = useAppDispatch();

  //# endregion

  //# region state

  const [imageState, setImageState] = useState<
    "loading" | "loaded" | "errored"
  >("loading");
  const image = useRef<HTMLImageElement>(null);

  //# endregion

  //# region callbacks

  const onLoadingComplete: OnLoadingComplete = (img) => {
    setImageState("loaded");
  };
  const onError: React.ReactEventHandler<HTMLImageElement> = (img) => {
    setImageState("errored");
  };
  const handleShowDetailedView = () => {
    if (showDetailedViewOnClick && maybeCardDocument != null) {
      dispatch(
        setSelectedCardAndShowModal([maybeCardDocument, "cardDetailedView"])
      );
    }
  };

  //# endregion

  //# region effects

  useEffect(() => {
    /**
     * Ensure that the small thumbnail fades in each time the selected image changes.
     * Next.js seems to not fire `onLoadingComplete` when opening a page with a cached image.
     * This implementation was retrieved from https://stackoverflow.com/a/59809184
     */

    setImageState(
      image.current == null || !image.current.complete ? "loading" : "loaded"
    );
  }, [maybeCardDocument?.identifier]);

  //# endregion

  //# region computed constants

  // TODO: always point at image server once it's stable
  const imageCDNURL = process.env.NEXT_PUBLIC_IMAGE_CDN_URL;
  const smallThumbnailURL =
    imageCDNURL != null
      ? `${imageCDNURL}/images/google_drive/small/${maybeCardDocument?.identifier}.jpg`
      : maybeCardDocument?.small_thumbnail_url;
  const mediumThumbnailURL =
    imageCDNURL != null
      ? `${imageCDNURL}/images/google_drive/large/${maybeCardDocument?.identifier}.jpg`
      : maybeCardDocument?.medium_thumbnail_url;
  const imageSrc: string | undefined =
    imageState !== "errored"
      ? small
        ? smallThumbnailURL
        : mediumThumbnailURL
      : small
      ? "/error_404.png"
      : "/error_404_med.png";
  const imageAlt = maybeCardDocument?.name ?? "Unnamed Card";

  //# endregion

  return (
    <>
      {imageState === "loading" && !hidden && <Spinner zIndex={2} />}
      {imageSrc != null &&
        (hidden ? (
          <HiddenImage
            ref={image}
            className="card-img"
            loading="lazy"
            src={imageSrc}
            onLoadingComplete={onLoadingComplete}
            onErrorCapture={onError}
            alt={imageAlt}
            fill={true}
          />
        ) : (
          <VisibleImage
            ref={image}
            className="card-img card-img-fade-in"
            loading="lazy"
            imageIsLoading={imageState === "loading"}
            showDetailedViewOnClick={showDetailedViewOnClick}
            src={imageSrc}
            onLoadingComplete={onLoadingComplete}
            onErrorCapture={onError}
            onClick={handleShowDetailedView}
            alt={imageAlt}
            fill={true}
          />
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

export function Card({
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
  /**
   * This component enables displaying cards with auxiliary information in a flexible, consistent way.
   */

  //# region computed constants

  const cardImageElements =
    maybeCardDocument != null ? (
      <>
        <MemoizedCardImage
          maybeCardDocument={maybeCardDocument}
          hidden={false}
          small={true}
          showDetailedViewOnClick={cardOnClick == null}
        />
        {maybePreviousCardDocument != null &&
          maybePreviousCardDocument.identifier !==
            maybeCardDocument?.identifier && (
            <MemoizedCardImage
              maybeCardDocument={maybePreviousCardDocument}
              hidden={true}
              small={true}
              showDetailedViewOnClick={false}
            />
          )}
        {maybeNextCardDocument != null &&
          maybeNextCardDocument.identifier !==
            maybeCardDocument?.identifier && (
            <MemoizedCardImage
              maybeCardDocument={maybeNextCardDocument}
              hidden={true}
              small={true}
              showDetailedViewOnClick={false}
            />
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
                `${maybeCardDocument.source_verbose} [${maybeCardDocument.dpi} DPI]`}
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
  /**
   * This component is a thin layer on top of `Card` that retrieves `CardDocument` items by their identifiers
   * from the Redux store (used in the project editor).
   * We have this layer because search results are returned as a list of image identifiers
   * (to minimise the quantity of data stored in Elasticsearch), so the full `CardDocument` items must be looked up.
   */

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
    <Card
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
