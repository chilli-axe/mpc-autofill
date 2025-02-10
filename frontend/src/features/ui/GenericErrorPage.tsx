import styled from "styled-components";

const TextWrapper = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
`;
const HeaderText = styled.h1`
  position: relative;
`;
export const LargerText = styled.p`
  font-size: 1.25em;
  position: relative;
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
