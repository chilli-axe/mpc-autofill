// credit: https://stackoverflow.com/a/57173209/13021511

import dynamic from "next/dynamic";
import React from "react";

const NoSSR = (props) => <React.Fragment>{props.children}</React.Fragment>;

export default dynamic(() => Promise.resolve(NoSSR), {
  ssr: false,
});
