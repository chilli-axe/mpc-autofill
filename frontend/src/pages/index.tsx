import Head from "next/head";
import Image from "next/image";
import React, { useCallback, useState } from "react";
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
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";
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

function DynamicLogo() {
  // TODO: set up custom hooks for using queries in this way (i.e. not querying until backend URL is specified)
  const backendURL = useSelector(selectBackendURL);
  const sampleCardsQuery = useGetSampleCardsQuery(undefined, {
    skip: backendURL == null,
  });
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });

  const [selectedImage, setSelectedImage] = useState<CardDocument | null>(null);
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const handleCloseDetailedView = () => setShowDetailedView(false);
  const handleShowDetailedView = useCallback((card: CardDocument) => {
    setSelectedImage(card);
    setShowDetailedView(true);
  }, []);

  // TODO: handle the no data case with a default image that reads "your design here" or something
  const displayCards: Array<
    [CardDocument, StyledComponent<"div", any, {}, never>]
  > = sampleCardsQuery.isSuccess
    ? [
        [sampleCardsQuery.data["TOKEN"][0], FirstImageTransformWrapper],
        [sampleCardsQuery.data["CARD"][0], SecondImageTransformWrapper],
        [sampleCardsQuery.data["CARD"][1], ThirdImageTransformWrapper],
        [sampleCardsQuery.data["CARD"][2], FourthImageTransformWrapper],
        [sampleCardsQuery.data["CARD"][3], FifthImageTransformWrapper],
      ]
    : [];

  return (
    <>
      {sampleCardsQuery.isSuccess ? (
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

          {displayCards.map(([cardDocument, WrapperElement]) => (
            <WrapperElement key={`${cardDocument.identifier}-outer-wrapper`}>
              <MemoizedCardProportionWrapper
                small={true}
                key={`${cardDocument.identifier}-inner-wrapper`}
              >
                <MemoizedCardImage
                  key={`${cardDocument.identifier}-image`}
                  cardDocument={cardDocument}
                  hidden={false}
                  small={true}
                  onClick={() => handleShowDetailedView(cardDocument)}
                />
              </MemoizedCardProportionWrapper>
            </WrapperElement>
          ))}
        </DynamicLogoContainer>
      ) : (
        <div />
      )}
      {selectedImage != null && (
        <MemoizedCardDetailedView
          imageIdentifier={selectedImage.identifier}
          show={showDetailedView}
          handleClose={handleCloseDetailedView}
          cardDocument={selectedImage}
        />
      )}
    </>
  );
}

export default function Index() {
  return (
    <>
      <Head>
        <title>{ProjectName}</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <br />
        <DynamicLogo />
        <Footer />
      </Layout>
    </>
  );
}
