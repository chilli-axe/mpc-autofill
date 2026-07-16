/**
 * This component is the URL-based entrypoint for cards into the project editor.
 * The backend returns a list of domains that it claims to know how to talk to,
 * displayed to the user. A freeform text box is exposed and the backend is asked
 * to process the URL when the user hits Submit.
 */

import React, { FormEvent, useCallback, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Stack from "react-bootstrap/Stack";

import {
  convertLinesIntoSlotProjectMembers,
  processStringAsMultipleLines,
} from "@/common/processing";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { Spinner } from "@/components/Spinner";
import { useGetDFCPairsQuery, useGetImportSitesQuery } from "@/store/api";
import { api } from "@/store/api";
import { useProjectName } from "@/store/slices/backendSlice";
import { addMembers, selectProjectSize } from "@/store/slices/projectSlice";
import { selectFuzzySearch } from "@/store/slices/searchSettingsSlice";
import { setNotification } from "@/store/slices/toastsSlice";

interface ImportURLProps {
  onImportComplete?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function ImportURL({ onImportComplete, inputRef }: ImportURLProps) {
  const dispatch = useAppDispatch();
  const dfcPairsQuery = useGetDFCPairsQuery();
  const importSitesQuery = useGetImportSitesQuery();
  const [triggerFn] = api.endpoints.queryImportSite.useLazyQuery();
  const projectName = useProjectName();
  const fuzzySearch = useAppSelector(selectFuzzySearch);
  const projectSize = useAppSelector(selectProjectSize);

  const [urlValue, setUrlValue] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? internalRef;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedURL = urlValue.trim();
      if (trimmedURL.length > 0) {
        setLoading(true);
        try {
          const query = await triggerFn(urlValue);
          const processedLines = processStringAsMultipleLines(
            query.data ?? "",
            dfcPairsQuery.data ?? {},
            fuzzySearch
          );
          dispatch(
            addMembers({
              members: convertLinesIntoSlotProjectMembers(
                processedLines,
                projectSize
              ),
            })
          );
          setUrlValue("");
          onImportComplete?.();
        } catch (error: any) {
          dispatch(
            setNotification([
              "url-import-error",
              {
                name: "URL Import Error",
                message: `An unexpected error occurred while processing your decklist: ${error.message}`,
                level: "error",
              },
            ])
          );
        } finally {
          setLoading(false);
        }
      }
    },
    [
      dispatch,
      urlValue,
      dfcPairsQuery.data,
      projectSize,
      triggerFn,
      fuzzySearch,
      onImportComplete,
    ]
  );

  const disabled =
    loading || importSitesQuery.isFetching || dfcPairsQuery.isFetching;

  if (
    !importSitesQuery.isFetching &&
    (importSitesQuery.data ?? []).length === 0
  ) {
    return null;
  }

  return (
    <>
      Paste a link to a card list hosted on one of the below sites (not
      affiliated) to import the list into {projectName}:
      <br />
      {importSitesQuery.data != null ? (
        <ul>
          {importSitesQuery.data.map((importSite) => (
            <li key={`${importSite.name}-row`}>
              <a key={importSite.name} href={importSite.url} target="_blank">
                {importSite.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <br />
          <Spinner />
          <br />
        </>
      )}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Control
            ref={ref}
            type="url"
            required={true}
            placeholder="https://"
            onChange={(event) => setUrlValue(event.target.value.trim())}
            value={urlValue}
            disabled={loading || importSitesQuery.data == null}
            aria-label="import-url"
          />
        </Form.Group>
        <Stack direction="horizontal" gap={1}>
          <div className="ms-auto">
            <Button
              type="submit"
              variant="primary"
              disabled={disabled}
              style={{ width: 4.75 + "em" }}
            >
              {loading ? <Spinner size={1.5} /> : "Submit"}
            </Button>
          </div>
        </Stack>
      </Form>
    </>
  );
}

export function ImportURLButton() {
  const importSitesQuery = useGetImportSitesQuery();
  const [show, setShow] = useState<boolean>(false);
  const focusRef = useRef<HTMLInputElement>(null);

  if (
    !importSitesQuery.isFetching &&
    (importSitesQuery.data ?? []).length === 0
  ) {
    return null;
  }

  return (
    <>
      <Dropdown.Item
        onClick={() => setShow(true)}
        disabled={importSitesQuery.isFetching}
      >
        {importSitesQuery.isFetching ? (
          <Spinner size={1.5} />
        ) : (
          <>
            <RightPaddedIcon bootstrapIconName="link-45deg" /> URL
          </>
        )}
      </Dropdown.Item>
      <Modal
        scrollable
        show={show}
        onEntered={() => focusRef.current?.focus()}
        onHide={() => setShow(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — URL</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ImportURL
            onImportComplete={() => setShow(false)}
            inputRef={focusRef}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
