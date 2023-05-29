import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import { useSelector } from "react-redux";
import styled, { keyframes, StyledComponent } from "styled-components";

import { useGetBackendInfoQuery, useGetSampleCardsQuery } from "@/app/api";
import { ProjectName } from "@/common/constants";
import { CardDocument } from "@/common/types";
import { selectBackendURL } from "@/features/backend/backendSlice";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/card";
import { MemoizedCardDetailedView } from "@/features/card/cardDetailedView";
import { Spinner } from "@/features/ui/spinner";
import { lato } from "@/pages/_app";

const DynamicLogoContainer = styled.div`
  position: relative;
  width: 85%;
  left: 7.5%;
  aspect-ratio: 1 / 1;
  background: linear-gradient(#4692f0, #183251);
  border-radius: 50%;
  // would like to do the first one of these with outline, but alas
  // all my homies hate safari
  box-shadow: 0 0 0 4px black, 0 1rem 2rem rgba(0, 0, 0, 0.4);
`;

const DynamicLogoLabel = styled.p`
  position: absolute;
  font-weight: bold;
  top: 19.3548%;
  left: 50%;
  z-index: 10;
  transform: translate(-50%, 0);
  // TODO: find a better implementation of font scaling
  font-size: min(4em, 10vw);
  text-shadow: 0 4px 15px #000000;
  white-space: nowrap;
`;

const DynamicLogoArrowKeyframes = keyframes`
  0% {
    transform: translate(-50%, 16%);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, 0);
    opacity: 1;
  }
`;

const DynamicLogoArrowWrapper = styled.div`
  width: 40%;
  height: 40%;
  position: absolute;
  left: 50%;
  animation: ${DynamicLogoArrowKeyframes} 0.75s ease-out 0.01s forwards;
`;

const ImageTransformWrapperBase = styled.div`
  position: absolute;
  height: 32.358%;
  width: 32.358%;
  left: 33.871%;
  top: 33.871%;
  transition-property: height, width, top, left, z-index;
  transition-duration: 0.15s;
  transition-timing-function: ease-in-out;
  &:hover {
    height: 40%;
    width: 40%;
    top: 20%;
    left: 30%;
    z-index: 20;
  }
`;

const FirstImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0, 0);
    rotate: 0;
  }
  100% {
    transform: translate(-120%, -27%);
    rotate: -40deg;
  }
`;

const FirstImageTransformWrapper = styled(ImageTransformWrapperBase)`
  z-index: 0;
  animation: ${FirstImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
`;

const SecondImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0, 0);
    rotate: 0;
  }
  100% {
    transform: translate(-60%, 0);
    rotate: -20deg;
  }
`;

const SecondImageTransformWrapper = styled(ImageTransformWrapperBase)`
  z-index: 1;
  animation: ${SecondImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
`;

const ThirdImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(0, 6%);
  }
`;

const ThirdImageTransformWrapper = styled(ImageTransformWrapperBase)`
  animation: ${ThirdImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
  z-index: 2;
`;

const FourthImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0, 0);
    rotate: 0;
  }
  100% {
    transform: translate(60%, 0);
    rotate: 20deg;
  }
`;

const FourthImageTransformWrapper = styled(ImageTransformWrapperBase)`
  animation: ${FourthImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
  z-index: 3;
`;

const FifthImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0, 0);
    rotate: 0;
  }
  100% {
    transform: translate(120%, -27%);
    rotate: 40deg;
  }
`;

const FifthImageTransformWrapper = styled(ImageTransformWrapperBase)`
  animation: ${FifthImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
  z-index: 4;
`;

const SampleCardDocument: CardDocument = {
  identifier: "your-design-here",
  card_type: "CARD",
  name: "Your Design Here",
  priority: 0,
  source: "",
  source_name: "",
  source_id: 0,
  source_verbose: "",
  source_type: "drive",
  dpi: 300,
  searchq: "",
  extension: "png",
  date: "1st January, 2000",
  download_link: "",
  size: 1,
  small_thumbnail_url: "/logo-blank.png",
  medium_thumbnail_url: "",
};

export function DynamicLogo() {
  // TODO: set up custom hooks for using queries in this way (i.e. not querying until backend URL is specified)
  const backendURL = useSelector(selectBackendURL);
  const sampleCardsQuery = useGetSampleCardsQuery(undefined, {
    skip: backendURL == null,
  });
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });

  // this ignores the initial flash of styled-components not doing the thing on first page load
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => setLoading(false), []);

  const [selectedImage, setSelectedImage] = useState<CardDocument | null>(null);
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const handleCloseDetailedView = () => setShowDetailedView(false);
  const handleShowDetailedView = useCallback((card: CardDocument) => {
    setSelectedImage(card);
    setShowDetailedView(true);
  }, []);

  const displayCards: Array<
    [CardDocument | null, StyledComponent<"div", any>]
  > = [
    [
      sampleCardsQuery.isSuccess ? sampleCardsQuery.data["TOKEN"][0] : null,
      FirstImageTransformWrapper,
    ],
    [
      sampleCardsQuery.isSuccess ? sampleCardsQuery.data["CARD"][0] : null,
      SecondImageTransformWrapper,
    ],
    [
      sampleCardsQuery.isSuccess ? sampleCardsQuery.data["CARD"][1] : null,
      ThirdImageTransformWrapper,
    ],
    [
      sampleCardsQuery.isSuccess ? sampleCardsQuery.data["CARD"][2] : null,
      FourthImageTransformWrapper,
    ],
    [
      sampleCardsQuery.isSuccess ? sampleCardsQuery.data["CARD"][3] : null,
      FifthImageTransformWrapper,
    ],
  ];

  return (
    <>
      {loading ? (
        <Spinner size={12} />
      ) : (
        <Row className="justify-content-center">
          <Col xl={6} lg={7} md={8} sm={12} xs={12}>
            <DynamicLogoContainer>
              <DynamicLogoLabel className={lato.className}>
                {backendInfoQuery.data?.name ?? ProjectName}
              </DynamicLogoLabel>
              <DynamicLogoArrowWrapper>
                <Image
                  src="/arrow.svg"
                  alt="logo-arrow"
                  quality={100}
                  fill={true}
                />
              </DynamicLogoArrowWrapper>

              {displayCards.map(
                ([maybeCardDocument, WrapperElement], index) => (
                  <WrapperElement key={`logo-card${index}-outer-wrapper`}>
                    <MemoizedCardProportionWrapper
                      bordered={maybeCardDocument == null}
                      small={true}
                      key={`$logo-card${index}-inner-wrapper`}
                    >
                      <MemoizedCardImage
                        key={`$logo-card${index}-image`}
                        cardDocument={
                          backendURL == null
                            ? SampleCardDocument
                            : maybeCardDocument
                        }
                        hidden={false}
                        small={true}
                        onClick={() => {
                          if (maybeCardDocument != null) {
                            return handleShowDetailedView(maybeCardDocument);
                          }
                        }}
                      />
                    </MemoizedCardProportionWrapper>
                  </WrapperElement>
                )
              )}
            </DynamicLogoContainer>
            {selectedImage != null && (
              <MemoizedCardDetailedView
                imageIdentifier={selectedImage.identifier}
                show={showDetailedView}
                handleClose={handleCloseDetailedView}
                cardDocument={selectedImage}
              />
            )}
          </Col>
        </Row>
      )}
    </>
  );
}
