/**
 * This component is a fundamental UI building block for displaying cards.
 * Displays a card's image, some extra information (its name, its source's name, and its DPI),
 * and has optional props for extending the component to include extra functionality.
 * If being used in a gallery, the previous and next images can be cached for visual smoothness.
 */

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

import { SearchQuery, useAppSelector } from "@/common/types";
import { CardDocument } from "@/common/types";
import { Spinner } from "@/features/ui/spinner";

const HiddenImage = styled(Image)`
  z-index: 0;
  opacity: 0;
`;

const VisibleImage = styled(Image)<{ imageIsLoading?: boolean }>`
  z-index: 1;
  opacity: ${(props) => (props.imageIsLoading ? 0 : 1)};
`;

interface CardImageProps {
  cardDocument: CardDocument | null;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  hidden: boolean;
  small: boolean;
}

function CardImage({ cardDocument, onClick, hidden, small }: CardImageProps) {
  const [imageLoading, setImageLoading] = useState(true);
  // ensure that the small thumbnail fades in each time the selected image changes
  useEffect(() => setImageLoading(true), [cardDocument?.identifier]);
  useEffect(() => {
    if (image.current != null && image.current.complete) {
      setImageLoading(false);
    }
  }, [cardDocument?.identifier]);

  // next.js seems to not fire `onLoadingComplete` when opening a page with a cached image
  // this implementation retrieved from https://stackoverflow.com/a/59809184
  const image = useRef<HTMLImageElement>(null);

  return (
    <>
      {hidden ? (
        <HiddenImage
          ref={image}
          className="card-img"
          loading="lazy"
          src={
            (small
              ? cardDocument?.small_thumbnail_url
              : cardDocument?.medium_thumbnail_url) ?? ""
          }
          onLoadingComplete={(img) => setImageLoading(false)}
          onClick={onClick}
          // onError={{thumbnail_404(this)}} // TODO
          alt={cardDocument?.name ?? ""}
          fill={true}
        />
      ) : (
        <>
          {imageLoading && <Spinner />}
          <VisibleImage
            ref={image}
            className="card-img card-img-fade-in"
            loading="lazy"
            imageIsLoading={imageLoading}
            src={
              (small
                ? cardDocument?.small_thumbnail_url
                : cardDocument?.medium_thumbnail_url) ?? ""
            }
            onLoadingComplete={(img) => setImageLoading(false)}
            onClick={onClick}
            alt={cardDocument?.name ?? ""}
            fill={true}
          />
        </>
      )}
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

interface CardRenameMeProps {
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
  /** A callback function for when the displayed image is clicked. */
  imageOnClick?: React.MouseEventHandler<HTMLImageElement>;
  /** A callback function for when the `Card` (the HTML surrounding the image) is clicked. */
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  /** The `SearchQuery` specified when searching for this card. */
  searchQuery?: SearchQuery | undefined;
  /** Whether no search results were found when searching for `searchQuery` under the configured search settings. */
  noResultsFound: boolean;
}

export function CardRenameMe({
  maybeCardDocument,
  maybePreviousCardDocument,
  maybeNextCardDocument,
  cardHeaderTitle,
  cardHeaderButtons,
  cardFooter,
  imageOnClick,
  cardOnClick,
  searchQuery,
  noResultsFound,
}: CardRenameMeProps) {
  /**
   * This component enables displaying cards with auxiliary information in a flexible, consistent way.
   */

  const cardImageElements =
    maybeCardDocument != null ? (
      <>
        <MemoizedCardImage
          cardDocument={maybeCardDocument}
          onClick={imageOnClick}
          hidden={false}
          small={true}
        />
        {maybeCardDocument?.identifier != null &&
          maybePreviousCardDocument?.identifier ===
            maybeCardDocument?.identifier &&
          maybePreviousCardDocument != null && (
            <MemoizedCardImage
              cardDocument={maybePreviousCardDocument}
              onClick={imageOnClick}
              hidden={true}
              small={true}
            />
          )}
        {maybeCardDocument?.identifier != null &&
          maybeNextCardDocument?.identifier === maybeCardDocument?.identifier &&
          maybeNextCardDocument != null && (
            <MemoizedCardImage
              cardDocument={maybeNextCardDocument}
              onClick={imageOnClick}
              hidden={true}
              small={true}
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
  return (
    <BSCard className="mpccard mpccard-hover" onClick={cardOnClick}>
      <BSCard.Header className="pb-0 text-center">
        <p className="mpccard-slot">{cardHeaderTitle}</p>
        {cardHeaderButtons}
      </BSCard.Header>
      <div>
        <MemoizedCardProportionWrapper small={true}>
          {cardImageElements}
        </MemoizedCardProportionWrapper>
        <BSCard.Body className="mb-0 text-center">
          <BSCard.Subtitle className="mpccard-name">
            {maybeCardDocument != null && maybeCardDocument.name}
            {maybeCardDocument == null &&
              searchQuery != undefined &&
              searchQuery.query}
          </BSCard.Subtitle>
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

export const MemoizedCardRenameMe = memo(CardRenameMe);

interface CardProps {
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
  /** A callback function for when the displayed image is clicked. */
  imageOnClick?: React.MouseEventHandler<HTMLImageElement>;
  /** A callback function for when the `Card` (the HTML surrounding the image) is clicked. */
  cardOnClick?: React.MouseEventHandler<HTMLElement>;
  /** The `SearchQuery` specified when searching for this card. */
  searchQuery?: SearchQuery | undefined;
  /** Whether no search results were found when searching for `searchQuery` under the configured search settings. */
  noResultsFound: boolean;
}

export function Card({
  imageIdentifier,
  previousImageIdentifier,
  nextImageIdentifier,
  cardHeaderTitle,
  cardHeaderButtons,
  cardFooter,
  imageOnClick,
  cardOnClick,
  searchQuery,
  noResultsFound,
}: CardProps) {
  /**
   * This component is a thin layer on top of `CardRenameMe` that retrieves `CardDocument` items by their identifiers
   * from the Redux store (used in the project editor).
   * We have this layer because search results are returned as a list of image identifiers
   * (to minimise the quantity of data stored in Elasticsearch), so the full `CardDocument` items must be looked up.
   */

  const maybeCardDocument = useAppSelector((state) =>
    imageIdentifier != null
      ? state.cardDocuments.cardDocuments[imageIdentifier]
      : undefined
  );

  const maybePreviousCardDocument = useAppSelector((state) =>
    previousImageIdentifier != null
      ? state.cardDocuments.cardDocuments[previousImageIdentifier]
      : undefined
  );
  const maybeNextCardDocument = useAppSelector((state) =>
    nextImageIdentifier != null
      ? state.cardDocuments.cardDocuments[nextImageIdentifier]
      : undefined
  );

  return (
    <CardRenameMe
      maybeCardDocument={maybeCardDocument}
      maybePreviousCardDocument={maybePreviousCardDocument}
      maybeNextCardDocument={maybeNextCardDocument}
      cardHeaderTitle={cardHeaderTitle}
      cardHeaderButtons={cardHeaderButtons}
      cardFooter={cardFooter}
      imageOnClick={imageOnClick}
      cardOnClick={cardOnClick}
      searchQuery={searchQuery}
      noResultsFound={noResultsFound}
    />
  );
}

export const MemoizedCard = memo(Card);
