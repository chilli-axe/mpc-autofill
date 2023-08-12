import { useRouter } from "next/router";
import { GoogleAnalytics } from "nextjs-google-analytics";
import React, { FormEvent, useEffect, useState } from "react";
import { PropsWithChildren } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import SSRProvider from "react-bootstrap/SSRProvider";
import { Provider } from "react-redux";
import styled from "styled-components";

import { useGetSampleCardsQuery } from "@/app/api";
import store from "@/app/store";
import { Card, ContentMaxWidth, NavbarHeight } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  setLocalStorageBackendURL,
} from "@/common/cookies";
import { standardiseURL } from "@/common/processing";
import {
  CardDocument,
  Slots,
  useAppDispatch,
  useAppSelector,
} from "@/common/types";
import { setURL, useBackendConfigured } from "@/features/backend/backendSlice";
import { MemoizedCardDetailedView } from "@/features/card/cardDetailedView";
import { bulkSetQuery } from "@/features/project/projectSlice";
import { Toasts } from "@/features/toasts/toasts";
import {
  hideModal,
  selectModalCard,
  selectModalSlots,
  selectShownModal,
} from "@/features/ui/modalSlice";
import ProjectNavbar from "@/features/ui/navbar";

function BackendSetter() {
  const router = useRouter();
  const { server } = router.query;
  const formattedURL: string | null =
    server != null && typeof server == "string" && server.length > 0
      ? standardiseURL(server.trim())
      : null;

  const dispatch = useAppDispatch();
  const backendConfigured = useBackendConfigured();
  useEffect(() => {
    if (!backendConfigured && formattedURL != null) {
      dispatch(setURL(formattedURL));
      setLocalStorageBackendURL(formattedURL);
      if (server != null && typeof server == "string" && server.length > 0) {
        // @ts-ignore  // TODO
        router.replace({ server }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, backendConfigured, formattedURL, dispatch]);

  return <></>;
}

interface MoveMeProps {
  slots: Slots;
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

function MoveMeIntoMyOwnModule({ slots, show, handleClose }: MoveMeProps) {
  const dispatch = useAppDispatch();

  const sampleCardsQuery = useGetSampleCardsQuery();
  const placeholderCardName =
    sampleCardsQuery.data != null &&
    (sampleCardsQuery.data ?? {})[Card][0] != null
      ? sampleCardsQuery.data[Card][0].name
      : "";

  const [
    changeSelectedImageQueriesModalValue,
    setChangeSelectedImageQueriesModalValue,
  ] = useState("");

  const handleSubmitChangeSelectedImageQueriesModal = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault(); // to avoid reloading the page
    dispatch(
      bulkSetQuery({ query: changeSelectedImageQueriesModalValue, slots })
    );
    handleClose();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      onExited={() => setChangeSelectedImageQueriesModalValue("")}
    >
      <Modal.Header closeButton>
        <Modal.Title>Change Query</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Type in a query to update the selected images with and hit <b>Submit</b>
        .
        <hr />
        <Form
          onSubmit={handleSubmitChangeSelectedImageQueriesModal}
          id="changeSelectedImageQueriesForm"
        >
          <Form.Group className="mb-3">
            <Form.Control
              type="text"
              placeholder={placeholderCardName}
              onChange={(event) =>
                setChangeSelectedImageQueriesModalValue(event.target.value)
              }
              value={changeSelectedImageQueriesModalValue}
              aria-label="change-selected-image-queries-text"
              required={true}
              autoFocus={true}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button
          type="submit"
          form="changeSelectedImageQueriesForm"
          variant="primary"
          aria-label="change-selected-image-queries-submit"
        >
          Submit
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function Modals() {
  // TODO: move the grid selector into here
  // TODO: move the developer and patreon support modals into here
  const selectedImage = useAppSelector(selectModalCard);
  const selectedSlots = useAppSelector(selectModalSlots);
  const shownModal = useAppSelector(selectShownModal);
  const dispatch = useAppDispatch();
  const handleClose = () => dispatch(hideModal());

  return (
    <>
      {selectedImage != null && (
        <MemoizedCardDetailedView
          cardDocument={selectedImage}
          show={shownModal === "cardDetailedView"}
          handleClose={handleClose}
        />
      )}
      {selectedSlots != null && (
        <MoveMeIntoMyOwnModule
          slots={selectedSlots}
          show={shownModal === "changeQuery"}
          handleClose={handleClose}
        />
      )}
    </>
  );
}

const OverscrollProvider = styled(Provider)`
  overscroll-behavior: none;
  overflow-x: hidden;
  overflow-y: hidden; // https://stackoverflow.com/a/69589919/13021511
`;

const ContentContainer = styled(Container)`
  top: ${NavbarHeight}px;
  height: calc(
    100vh - ${NavbarHeight}px
  ); // for compatibility with older browsers
  height: calc(100dvh - ${NavbarHeight}px); // handles the ios address bar
  position: fixed;
  overflow-y: scroll;
  overflow-x: hidden;
`;

const MaxWidthContainer = styled(Container)`
  max-width: ${ContentMaxWidth}px;
`;

interface ProjectContainerProps {
  gutter?: number;
}

export function ProjectContainer({
  gutter = 2,
  children,
}: PropsWithChildren<ProjectContainerProps>) {
  return (
    <ContentContainer fluid className={`g-${gutter}`}>
      <MaxWidthContainer className={`g-${gutter}`}>
        {children}
      </MaxWidthContainer>
    </ContentContainer>
  );
}

export function LayoutWithoutProvider({ children }: PropsWithChildren) {
  const consent = getGoogleAnalyticsConsent();
  return (
    <>
      {consent === true && <GoogleAnalytics trackPageViews />}
      <Toasts />
      <Modals />
      <BackendSetter />
      <ProjectNavbar />
      {children}
    </>
  );
}

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <SSRProvider>
        <OverscrollProvider store={store}>
          <LayoutWithoutProvider>{children}</LayoutWithoutProvider>
        </OverscrollProvider>
      </SSRProvider>
    </>
  );
}
