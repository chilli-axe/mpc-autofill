import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
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

const DynamicLogoContainer = styled(Container)`
  position: relative;
  height: 620px;
  width: 620px;
  background: linear-gradient(#4692f0, #183251);
  border-radius: 300px;
  outline: solid 4px black;
`;

const DynamicLogoLabel = styled.p`
  position: absolute;
  font-weight: bold;
  top: 120px;
  left: 50%;
  z-index: 10;
  text-align: center;
  transform: translate(-50%, 0px);
  font-size: 5em;
  text-shadow: 0 4px 15px #000000;
  white-space: nowrap;
`;

const DynamicLogoArrowKeyframes = keyframes`
  0% {
    transform: translate(-50%, 100px);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, 0px);
    opacity: 1;
  }
`;

const DynamicLogoArrow = styled(Image)`
  position: absolute;
  left: 50%;
  animation: ${DynamicLogoArrowKeyframes} 0.75s ease-out forwards;
`;

const ImageTransformWrapperBase = styled.div`
  position: absolute;
  height: 200px;
  width: 200px;
  left: 210px;
  top: 210px;
`;

const FirstImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0px, 0px);
    rotate: 0;
  }
  100% {
    transform: translate(-240px, -50px);
    rotate: -40deg;
  }
`;

const FirstImageTransformWrapper = styled(ImageTransformWrapperBase)`
  z-index: 0;
  animation: ${FirstImageTransformKeyframes} 1s ease-in-out forwards;
`;

const SecondImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0px, 0px);
    rotate: 0;
  }
  100% {
    transform: translate(-120px, 0px);
    rotate: -20deg;
  }
`;

const SecondImageTransformWrapper = styled(ImageTransformWrapperBase)`
  z-index: 1;
  animation: ${SecondImageTransformKeyframes} 1s ease-in-out forwards;
`;

const ThirdImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0px, 0px);
  }
  100% {
    transform: translate(0px, 15px);
  }
`;

const ThirdImageTransformWrapper = styled(ImageTransformWrapperBase)`
  animation: ${ThirdImageTransformKeyframes} 1s ease-in-out forwards;
  z-index: 2;
`;

const FourthImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0px, 0px);
    rotate: 0;
  }
  100% {
    transform: translate(120px, 0px);
    rotate: 20deg;
  }
`;

const FourthImageTransformWrapper = styled(ImageTransformWrapperBase)`
  animation: ${FourthImageTransformKeyframes} 1s ease-in-out forwards;
  z-index: 3;
`;

const FifthImageTransformKeyframes = keyframes`
  0% {
    transform: translate(0px, 0px);
    rotate: 0;
  }
  100% {
    transform: translate(240px, -50px);
    rotate: 40deg;
  }
`;

const FifthImageTransformWrapper = styled(ImageTransformWrapperBase)`
  animation: ${FifthImageTransformKeyframes} 1s ease-in-out forwards;
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
        <>
          <DynamicLogoContainer className="shadow-lg">
            <DynamicLogoLabel className={lato.className}>
              {backendInfoQuery.data?.name ?? ProjectName}
            </DynamicLogoLabel>
            <DynamicLogoArrow
              src="/arrow.svg"
              alt="logo-arrow"
              width={250}
              height={250}
              quality={100}
            />

            {displayCards.map(([maybeCardDocument, WrapperElement], index) => (
              <WrapperElement key={`logo-card${index}-outer-wrapper`}>
                <MemoizedCardProportionWrapper
                  bordered={maybeCardDocument == null}
                  small={true}
                  key={`$logo-card${index}-inner-wrapper`}
                >
                  <MemoizedCardImage
                    key={`$logo-card${index}-image`}
                    cardDocument={maybeCardDocument ?? SampleCardDocument}
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
            ))}
          </DynamicLogoContainer>
          {selectedImage != null && (
            <MemoizedCardDetailedView
              imageIdentifier={selectedImage.identifier}
              show={showDetailedView}
              handleClose={handleCloseDetailedView}
              cardDocument={selectedImage}
            />
          )}
        </>
      )}
    </>
  );
}
