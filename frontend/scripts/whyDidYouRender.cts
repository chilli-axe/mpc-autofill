import React from "react";

if (process.env.NODE_ENV === "development") {
  // eslint-disable-next-line
  import whyDidYouRender from "@welldone-software/why-did-you-render";
  // @ts-ignore
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}
