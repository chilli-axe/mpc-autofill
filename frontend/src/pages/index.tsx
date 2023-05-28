import Head from "next/head";
import Image from "next/image";
import React, { useCallback, useState } from "react";
import Container from "react-bootstrap/Container";
import { useSelector } from "react-redux";
import styled, { StyledComponent } from "styled-components";

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
  font-style: italic;
  top: 110px;
  left: 50%;
  z-index: 10;
  text-align: center;
  transform: translate(-50%, 0px);
  font-size: 5em;
  text-shadow: 0 4px 15px #000000;
  white-space: nowrap;
`;

const DynamicLogoArrow = styled(Image)`
  position: absolute;
  left: 50%;
  transform: translate(-50%, 0px);
`;

const ImageTransformWrapperBase = styled.div`
  position: absolute;
  height: 200px;
  width: 200px;
  left: 210px;
  top: 185px;
`;

const FirstImageTransformWrapper = styled(ImageTransformWrapperBase)`
  transform: translate(-200px, -20px);
  rotate: -40deg;
  z-index: 0;
`;
const SecondImageTransformWrapper = styled(ImageTransformWrapperBase)`
  transform: translate(-100px, 15px);
  rotate: -20deg;
  z-index: 1;
`;

const ThirdImageTransformWrapper = styled(ImageTransformWrapperBase)`
  transform: translate(0px, 15px);
  z-index: 2;
`;

const FourthImageTransformWrapper = styled(ImageTransformWrapperBase)`
  transform: translate(100px, 15px);
  rotate: 20deg;
  z-index: 3;
`;

const FifthImageTransformWrapper = styled(ImageTransformWrapperBase)`
  transform: translate(200px, -20px);
  rotate: 40deg;
  z-index: 4;
`;

function DynamicLogo() {
  // 57f653
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
          <DynamicLogoLabel className="orpheus">
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
