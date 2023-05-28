import Head from "next/head";
import Image from "next/image";
import React, { useCallback, useState } from "react";
import Container from "react-bootstrap/Container";
import { useSelector } from "react-redux";

import { useGetSampleCardsQuery } from "@/app/api";
import { ProjectName } from "@/common/constants";
import { selectBackendURL } from "@/features/backend/backendSlice";
import {
  MemoizedCardImage,
  MemoizedCardProportionWrapper,
} from "@/features/card/card";
import { MemoizedCardDetailedView } from "@/features/card/cardDetailedView";
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";

function DynamicLogo() {
  // 57f653
  // TODO: set up custom hooks for using queries in this way (i.e. not querying until backend URL is specified)
  const backendURL = useSelector(selectBackendURL);
  const sampleCardsQuery = useGetSampleCardsQuery(undefined, {
    skip: backendURL == null,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const handleCloseDetailedView = () => setShowDetailedView(false);
  const handleShowDetailedView = useCallback((img: string) => {
    setSelectedImage(img);
    setShowDetailedView(true);
  }, []);

  const documentsByIdentifier = sampleCardsQuery.isSuccess
    ? {
        [sampleCardsQuery.data["TOKEN"][0].identifier]:
          sampleCardsQuery.data["TOKEN"][0],
        [sampleCardsQuery.data["CARD"][0].identifier]:
          sampleCardsQuery.data["CARD"][0],
        [sampleCardsQuery.data["CARD"][1].identifier]:
          sampleCardsQuery.data["CARD"][1],
        [sampleCardsQuery.data["CARD"][2].identifier]:
          sampleCardsQuery.data["CARD"][2],
        [sampleCardsQuery.data["CARD"][3].identifier]:
          sampleCardsQuery.data["CARD"][3],
      }
    : {};

  return (
    <>
      {sampleCardsQuery.isSuccess ? (
        <Container
          className="shadow-lg"
          style={{
            position: "relative",
            height: 620 + "px",
            width: 620 + "px",
            background: "linear-gradient(#4692f0, #183251)",
            borderRadius: 300 + "px",
            outline: "solid",
            outlineWidth: 4 + "px",
            outlineColor: "black",
          }}
        >
          <p
            className="orpheus"
            style={{
              position: "absolute",
              fontWeight: "bold",
              fontStyle: "italic",
              top: 80 + "px",
              left: 50 + "%",
              zIndex: 10,
              textAlign: "center",
              transform: "translate(-50%, 0px)",
              fontSize: 3.2 + "em",
              textShadow: "0px 4px 15px #000000",
            }}
          >
            MPC Autofill
          </p>
          <Image
            src="/arrow.svg"
            alt="logo-arrow"
            width={250}
            height={250}
            quality={100}
            style={{
              position: "absolute",
              left: 50 + "%",
              transform: "translate(-50%, 0px)",
            }}
          />

          <div
            style={{
              position: "absolute",
              height: 200 + "px",
              width: 200 + "px",
              left: 210 + "px",
              top: 185 + "px",
              transform: "translate(-200px, -20px)",
              zIndex: 0,
              rotate: -40 + "deg",
            }}
          >
            <MemoizedCardProportionWrapper small={true}>
              <MemoizedCardImage
                cardDocument={sampleCardsQuery.data["TOKEN"][0]}
                hidden={false}
                small={true}
                onClick={() =>
                  handleShowDetailedView(
                    sampleCardsQuery.data["TOKEN"][0].identifier
                  )
                }
              />
            </MemoizedCardProportionWrapper>
          </div>
          <div
            style={{
              position: "absolute",
              height: 200 + "px",
              width: 200 + "px",
              left: 210 + "px",
              top: 185 + "px",
              transform: "translate(-100px, 15px)",
              zIndex: 1,
              rotate: -20 + "deg",
            }}
          >
            <MemoizedCardProportionWrapper small={true}>
              <MemoizedCardImage
                cardDocument={sampleCardsQuery.data["CARD"][0]}
                hidden={false}
                small={true}
                onClick={() =>
                  handleShowDetailedView(
                    sampleCardsQuery.data["CARD"][0].identifier
                  )
                }
              />
            </MemoizedCardProportionWrapper>
          </div>
          <div
            style={{
              position: "absolute",
              height: 200 + "px",
              width: 200 + "px",
              left: 210 + "px",
              top: 185 + "px",
              transform: "translate(0px, 15px)",
              zIndex: 2,
            }}
          >
            <MemoizedCardProportionWrapper small={true}>
              <MemoizedCardImage
                cardDocument={sampleCardsQuery.data["CARD"][1]}
                hidden={false}
                small={true}
                onClick={() =>
                  handleShowDetailedView(
                    sampleCardsQuery.data["CARD"][1].identifier
                  )
                }
              />
            </MemoizedCardProportionWrapper>
          </div>
          <div
            style={{
              position: "absolute",
              height: 200 + "px",
              width: 200 + "px",
              left: 210 + "px",
              top: 185 + "px",
              transform: "translate(100px, 15px)",
              zIndex: 3,
              rotate: 20 + "deg",
            }}
          >
            <MemoizedCardProportionWrapper small={true}>
              <MemoizedCardImage
                cardDocument={sampleCardsQuery.data["CARD"][2]}
                hidden={false}
                small={true}
                onClick={() =>
                  handleShowDetailedView(
                    sampleCardsQuery.data["CARD"][2].identifier
                  )
                }
              />
            </MemoizedCardProportionWrapper>
          </div>
          <div
            style={{
              position: "absolute",
              height: 200 + "px",
              width: 200 + "px",
              left: 210 + "px",
              top: 185 + "px",
              transform: "translate(200px, -20px)",
              zIndex: 4,
              rotate: 40 + "deg",
            }}
          >
            <MemoizedCardProportionWrapper small={true}>
              <MemoizedCardImage
                cardDocument={sampleCardsQuery.data["CARD"][3]}
                hidden={false}
                small={true}
                onClick={() =>
                  handleShowDetailedView(
                    sampleCardsQuery.data["CARD"][3].identifier
                  )
                }
              />
            </MemoizedCardProportionWrapper>
          </div>
        </Container>
      ) : (
        <div />
      )}
      {selectedImage != null && (
        <MemoizedCardDetailedView
          imageIdentifier={selectedImage}
          show={showDetailedView}
          handleClose={handleCloseDetailedView}
          cardDocument={documentsByIdentifier[selectedImage]}
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
