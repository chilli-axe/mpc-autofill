import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import { PDFGenerator } from "@/features/pdf/PDFGenerator";

interface PDFGeneratorProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export function PDFGeneratorModal({ show, handleClose }: PDFGeneratorProps) {
  return (
    <Modal scrollable show={show} onHide={handleClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Generate PDF</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <PDFGenerator />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
