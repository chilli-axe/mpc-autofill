import styled from "styled-components";

const TextWrapper = styled.div`
  position: absolute;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  text-align: center;
`;

export const LargerText = styled.p`
  font-size: 1.25em;
`;

interface ErrorPageProps {
  title: string;
  text: Array<string>;
}

export function GenericErrorPage({ title, text }: ErrorPageProps) {
  return (
    <TextWrapper>
      <h1>{title}</h1>
      {text.map((line, index) => (
        <LargerText key={index.toString()}>{line}</LargerText>
      ))}
    </TextWrapper>
  );
}
