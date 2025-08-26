import Image from "next/image";
import React, { useEffect, useState } from "react";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import styled, { css, keyframes, StyledComponent } from "styled-components";

import { QueryTags } from "@/common/constants";
import { CardType } from "@/common/schema_types";
import { CardDocument, useAppDispatch } from "@/common/types";
import { Spinner } from "@/components/Spinner";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/Card";
import { lato } from "@/pages/_app";
import { api, useGetSampleCardsQuery } from "@/store/api";
import {
  useBackendConfigured,
  useProjectName,
} from "@/store/slices/backendSlice";

//# region styled components

// note: i'm using transform3d rather than transform bc it apparently fixes animations on ios safari
// https://www.reddit.com/r/webdev/comments/iv26y7/iossafari_css_animation_not_working/

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
  transform: translate3d(-50%, 0, 0);
  // TODO: find a better implementation of font scaling
  font-size: min(4em, 10vw);
  text-shadow: 0 4px 15px #000000;
  white-space: nowrap;
  user-select: none;
  color: white;
`;

const DynamicLogoArrowKeyframes = keyframes`
  0% {
    transform: translate3d(-50%, 16%, 0);
    opacity: 0;
  }
  100% {
    transform: translate3d(-50%, 0, 0);
    opacity: 1;
  }
`;

const DynamicLogoArrowWrapper = styled.div<{ animated?: boolean }>`
  width: 40%;
  height: 40%;
  position: absolute;
  left: 50%;
  transform: translate3d(-50%, -16%, 0);
  opacity: 0;
  ${(props) =>
    props.animated === true &&
    css`
      animation: ${DynamicLogoArrowKeyframes} 0.75s ease-out 0.01s forwards;
    `}
`;

const ImageTransformWrapperBase = styled.div<{
  animated?: boolean;
}>`
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
    transform: translate3d(0, 0, 0);
    rotate: 0;
  }
  100% {
    transform: translate3d(-120%, -27%, 0);
    rotate: -40deg;
  }
`;

const FirstImageTransformWrapper = styled(ImageTransformWrapperBase)<{
  animated?: boolean;
}>`
  z-index: 0;
  ${(props) =>
    props.animated === true &&
    css`
      animation: ${FirstImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
    `}
`;

const SecondImageTransformKeyframes = keyframes`
  0% {
    transform: translate3d(0, 0, 0);
    rotate: 0;
  }
  100% {
    transform: translate3d(-60%, 0, 0);
    rotate: -20deg;
  }
`;

const SecondImageTransformWrapper = styled(ImageTransformWrapperBase)<{
  animated?: boolean;
}>`
  z-index: 1;
  ${(props) =>
    props.animated === true &&
    css`
      animation: ${SecondImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
    `}
`;

const ThirdImageTransformKeyframes = keyframes`
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(0, 6%, 0);
  }
`;

const ThirdImageTransformWrapper = styled(ImageTransformWrapperBase)<{
  animated?: boolean;
}>`
  z-index: 2;
  ${(props) =>
    props.animated === true &&
    css`
      animation: ${ThirdImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
    `}
`;

const FourthImageTransformKeyframes = keyframes`
  0% {
    transform: translate3d(0, 0, 0);
    rotate: 0;
  }
  100% {
    transform: translate3d(60%, 0, 0);
    rotate: 20deg;
  }
`;

const FourthImageTransformWrapper = styled(ImageTransformWrapperBase)<{
  animated?: boolean;
}>`
  z-index: 3;
  ${(props) =>
    props.animated === true &&
    css`
      animation: ${FourthImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
    `}
`;

const FifthImageTransformKeyframes = keyframes`
  0% {
    transform: translate3d(0, 0, 0);
    rotate: 0;
  }
  100% {
    transform: translate3d(120%, -27%, 0);
    rotate: 40deg;
  }
`;

const FifthImageTransformWrapper = styled(ImageTransformWrapperBase)<{
  animated?: boolean;
}>`
  z-index: 4;
  ${(props) =>
    props.animated === true &&
    css`
      animation: ${FifthImageTransformKeyframes} 1s ease-in-out 0.01s forwards;
    `}
`;

//# endregion

const SampleCardDocument: CardDocument = {
  identifier: "your-design-here",
  cardType: CardType.Card,
  name: "Your Design Here",
  priority: 0,
  source: "",
  sourceName: "",
  sourceId: 0,
  sourceVerbose: "",
  sourceType: undefined,
  sourceExternalLink: undefined,
  dpi: 300,
  searchq: "",
  extension: "png",
  dateCreated: "1st January, 2000",
  dateModified: "1st January, 2000",
  downloadLink: "",
  size: 1,
  smallThumbnailUrl: "/logo-blank.png",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export function DynamicLogo() {
  //# region hooks and queries

  const dispatch = useAppDispatch();
  const backendConfigured = useBackendConfigured();
  const projectName = useProjectName();
  const sampleCardsQuery = useGetSampleCardsQuery();

  //# endregion

  //# region state

  const [loading, setLoading] = useState<boolean>(true);

  //# endregion

  //# region effects

  useEffect(() => {
    dispatch(api.util.invalidateTags([QueryTags.SampleCards]));
  }, [dispatch]);
  // this ignores the initial flash of styled-components not doing the thing on first page load
  useEffect(() => setLoading(false), []);

  //# endregion

  //# region computed constants

  const displayCards: Array<
    [
      CardDocument | null,
      StyledComponent<typeof ImageTransformWrapperBase, any>
    ]
  > = [
    [
      sampleCardsQuery.isSuccess
        ? sampleCardsQuery.data["TOKEN"][0] ??
          sampleCardsQuery.data["CARDBACK"][0]
        : null,
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
  const animated = !backendConfigured || sampleCardsQuery.isSuccess;

  //# endregion

  return (
    <>
      {loading ? (
        <Spinner size={12} />
      ) : (
        <Row className="justify-content-center" data-testid="dynamic-logo">
          <Col xl={6} lg={7} md={8} sm={12} xs={12}>
            <DynamicLogoContainer>
              <DynamicLogoLabel className={lato.className}>
                {projectName}
              </DynamicLogoLabel>
              <DynamicLogoArrowWrapper animated={animated}>
                <Image
                  src="/arrow.svg"
                  alt="logo-arrow"
                  quality={100}
                  fill={true}
                />
              </DynamicLogoArrowWrapper>

              {displayCards.map(
                ([maybeCardDocument, WrapperElement], index) => (
                  <WrapperElement
                    key={`logo-card${index}-outer-wrapper`}
                    animated={animated}
                  >
                    <MemoizedCardProportionWrapper
                      bordered={!backendConfigured}
                      small={true}
                      key={`$logo-card${index}-inner-wrapper`}
                    >
                      <MemoizedCardImage
                        key={`$logo-card${index}-image`}
                        maybeCardDocument={
                          backendConfigured
                            ? maybeCardDocument
                            : SampleCardDocument
                        }
                        hidden={false}
                        small={true}
                        showDetailedViewOnClick={backendConfigured}
                      />
                    </MemoizedCardProportionWrapper>
                  </WrapperElement>
                )
              )}
            </DynamicLogoContainer>
          </Col>
        </Row>
      )}
    </>
  );
}
