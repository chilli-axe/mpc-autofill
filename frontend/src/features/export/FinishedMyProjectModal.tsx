import styled from "@emotion/styled";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";

import { MakePlayingCards, MakePlayingCardsURL } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { Coffee } from "@/components/Coffee";
import { RightPaddedIcon } from "@/components/icon";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { useDownloadXML } from "@/features/download/downloadXML";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import { LocalFilesService } from "@/features/localFiles/localFilesService";
import { useProjectName } from "@/store/slices/backendSlice";
import { showModal } from "@/store/slices/modalsSlice";
import { selectIsProjectEmpty } from "@/store/slices/projectSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch } from "@/store/store";

interface ExitModal {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

const BigOL = styled.ol`
  list-style-type: none;
`;

const BigLI = styled.li`
  counter-increment: step-counter;
  position: relative;
  padding: 10px 10px;
  &::before {
    content: counter(step-counter);
    color: white;
    font-size: 1.5rem;
    position: absolute;
    --size: 32px;
    left: calc(-1 * var(--size) - 2px);
    line-height: var(--size);
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    border: white 1px solid;
    text-align: center;
  }
`;

const DownloadButton = styled(Col)`
  text-align: center;
  border-color: lightblue;
  border-width: 2px;
  border-style: solid;
  border-radius: 6px;
  padding-top: 10px;
  padding-bottom: 10px;
  transition: background-color 0.15s ease-in-out;
  background-color: rgba(0, 0, 0, 0);
  &:hover {
    background-color: rgba(255, 255, 255, 0.7);
  }
  cursor: pointer;
`;

const DownloadButtonLink = styled.a`
  &:link {
    color: white;
    text-decoration: none;
  }
  &:visited {
    color: white;
    text-decoration: none;
  }
  &:not([href]) {
    color: white;
    text-decoration: none;
  }
`;

async function downloadDesktopTool(
  dispatch: AppDispatch,
  url: URL,
  fileName: string,
  localFilesService: LocalFilesService
) {
  dispatch(
    setNotification([
      Math.random().toString(),
      {
        name: "Download Started",
        message: `Started downloading the Desktop Tool to ${
          localFilesService.getDirectoryHandle()?.name ?? "Downloads folder"
        }!`,
        level: "info",
      },
    ])
  );
  await downloadFile(undefined, url, fileName, localFilesService);
  dispatch(
    setNotification([
      Math.random().toString(),
      {
        name: "Download Complete",
        message: `Successfully downloaded the Desktop Tool to ${
          localFilesService.getDirectoryHandle()?.name ?? "Downloads folder"
        }!`,
        level: "info",
      },
    ])
  );
  return true;
}

export function useDownloadDesktopTool() {
  const dispatch = useAppDispatch();
  const doFileDownload = useDoFileDownload();
  const { localFilesService } = useLocalFilesContext();
  return (url: URL, fileName: string) =>
    Promise.resolve(
      doFileDownload(
        "desktop-tool",
        fileName,
        (): Promise<boolean> =>
          downloadDesktopTool(dispatch, url, fileName, localFilesService)
      )
    );
}

function ProjectDownload() {
  const downloadXML = useDownloadXML();
  const projectName = useProjectName();
  return (
    <>
      <p>
        An XML file is a snapshot of all the cards and image versions you
        selected. Our desktop tool reads this file and automatically turns it
        into an order with {MakePlayingCards}.
      </p>
      <p>
        You also can <b>re-upload</b> your XML file to {projectName} and{" "}
        <b>continue editing it later</b>!
      </p>
      <Row>
        <Col md={{ span: 8, offset: 2 }} sm={12}>
          <DownloadButton onClick={downloadXML}>
            <DownloadButtonLink>
              <h1 className="bi bi-file-code"></h1>
              <h4>Download Project as XML</h4>
            </DownloadButtonLink>
          </DownloadButton>
        </Col>
      </Row>
    </>
  );
}

type Platform = "windows" | "macos-intel" | "macos-arm" | "linux";
const FileNameByPlatform: { [platform in Platform]: string } = {
  // TODO: can we remove this from our frontend code?
  windows: "autofill-windows.exe",
  "macos-intel": "autofill-macos-intel.command",
  "macos-arm": "autofill-macos-arm.command",
  linux: "autofill-linux.bin",
};

function PlatformDownload({
  platform,
  platformName,
  icon,
}: {
  platform: Platform;
  platformName: string;
  icon: string;
}) {
  const assetURL = `https://download.mpcautofill.com/?platform=${platform}`;
  const downloadDesktopTool = useDownloadDesktopTool();
  return (
    <>
      <DownloadButton>
        <DownloadButtonLink
          onClick={() =>
            downloadDesktopTool(new URL(assetURL), FileNameByPlatform[platform])
          }
        >
          <h1 className={`bi bi-${icon}`}></h1>
          <h4>{platformName}</h4>
        </DownloadButtonLink>
      </DownloadButton>
      <br />
    </>
  );
}

function DesktopToolDownload() {
  return (
    <>
      <p>
        Download the desktop tool for your platform. If you&apos;d rather
        download the source code instead, you can find it{" "}
        <a
          href="https://github.com/chilli-axe/mpc-autofill/tree/master/desktop-tool/"
          target="_blank"
        >
          here
        </a>
        !
      </p>
      <Row gap={2}>
        <Col sm={3}>
          <PlatformDownload
            platformName="Windows"
            platform="windows"
            icon="windows"
          />
        </Col>
        <Col sm={3}>
          <PlatformDownload
            platformName="macOS — Intel"
            platform="macos-intel"
            icon="apple"
          />
        </Col>
        <Col sm={3}>
          <PlatformDownload
            platformName="macOS — ARM"
            platform="macos-arm"
            icon="apple"
          />
        </Col>
        <Col sm={3}>
          <PlatformDownload
            platformName="Linux"
            platform="linux"
            icon="ubuntu"
          />
        </Col>
      </Row>
      <Alert variant="info" className="text-center">
        <b>Having trouble with the above buttons?</b> Grab it directly from
        GitHub{" "}
        <a
          href="https://github.com/chilli-axe/mpc-autofill/releases/latest/"
          target="_blank"
        >
          here
        </a>
        !
      </Alert>
    </>
  );
}

export function FinishedMyProjectModal({ show, handleClose }: ExitModal) {
  return (
    <Modal size="xl" scrollable show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>I&apos;ve Finished My Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h5 className="text-center">
          Nice work! There are three simple steps for turning your project into
          an order with{" "}
          <a href={MakePlayingCardsURL} target="_blank">
            {MakePlayingCards}
          </a>
          .
        </h5>
        <BigOL>
          <BigLI className="py-3">
            <h3>Download Your Project</h3>
            <ProjectDownload />
          </BigLI>
          <BigLI className="py-3">
            <h3>Download the Desktop Tool</h3>
            <DesktopToolDownload />
          </BigLI>
          <BigLI className="py-3">
            <h3>Run the Desktop Tool</h3>
            <p>
              Move the program and your XML file into <b>the same folder</b>{" "}
              (for example, put them both on your desktop), then double-click
              the desktop tool to run it!
            </p>
            <p>
              It&apos;ll ask you a few questions when it starts up, then you get
              to sit back and watch the magic happen. Check out our wiki{" "}
              <a
                href="https://github.com/chilli-axe/mpc-autofill/wiki/Desktop-Tool"
                target="_blank"
              >
                here
              </a>{" "}
              for more detailed instructions.
            </p>
          </BigLI>
        </BigOL>
        <hr />
        <h5 className="text-center">
          And that&apos;s all there is to it!{" "}
          <i className="bi bi-rocket-takeoff" />
        </h5>
        <p className="text-center">
          If this software has brought you joy and you&apos;d like to throw a
          few bucks my way, you can find my tip jar here{" "}
          <i className="bi bi-heart" />
        </p>
        <Coffee />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function FinishedMyProject() {
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);
  const dispatch = useAppDispatch();
  return !isProjectEmpty ? (
    <div className="d-grid gap-0">
      <Button
        variant="success"
        id="dropdown-basic"
        onClick={() => dispatch(showModal("finishedMyProject"))}
      >
        <RightPaddedIcon bootstrapIconName="bag-check" /> I&apos;ve Finished My
        Project
      </Button>
    </div>
  ) : null;
}
