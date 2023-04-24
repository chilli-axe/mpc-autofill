/**
 * A small wrapper around the `react-dropzone` Dropzone for consistent presentation.
 */

import React, { useCallback } from "react";
import { DropzoneRootProps, useDropzone } from "react-dropzone";
import styled from "styled-components"; // TODO: see if we can remove this new dependency

const getColor = (props: DropzoneRootProps) => {
  if (props.isDragAccept) {
    return "#00e676";
  }
  if (props.isDragReject) {
    return "#ff1744";
  }
  if (props.isFocused) {
    return "#2196f3";
  }
  return "#eeeeee";
};

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-width: 2px;
  border-radius: 2px;
  border-color: ${(props: DropzoneRootProps) => getColor(props)};
  border-style: dashed;
  color: #bdbdbd;
  outline: none;
  transition: border 0.24s ease-in-out;
  cursor: pointer;
`;

interface StyledDropzoneProps {
  mimeTypes: { [mimeType: string]: Array<string> };
  callback: {
    (fileContent: string): void;
  };
}

export function TextFileDropzone(props: StyledDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: Array<File>) => {
    acceptedFiles.forEach((file: File) => {
      // TODO: handle errors correctly
      const reader = new FileReader();
      reader.onabort = () => console.log("file reading was aborted");
      reader.onerror = () => console.log("file reading has failed");
      reader.onload = () => {
        // @ts-ignore  // TODO
        const fileContents: string = reader.result;
        props.callback(fileContents);
      };
      reader.readAsText(file);
    });
  }, []);

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({ onDrop, accept: props.mimeTypes, maxFiles: 1 });

  return (
    <div className="container">
      <Container {...getRootProps({ isFocused, isDragAccept, isDragReject })}>
        <input {...getInputProps()} />
        Drag and drop a file here, or click to select a file.
      </Container>
    </div>
  );
}
