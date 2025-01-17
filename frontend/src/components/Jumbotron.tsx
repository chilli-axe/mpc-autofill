import { DOMAttributes, HTMLAttributes, PropsWithChildren } from "react";
import { Variant } from "react-bootstrap/types";

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant: Variant;
}

export function Jumbotron({
  children,
  variant,
  ...rest
}: PropsWithChildren<Props>) {
  return (
    <div className={`bg-${variant} rounded-lg mt-2`} {...rest}>
      <div className="p-3">{children}</div>
    </div>
  );
}
