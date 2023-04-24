import { Head, Html, Main, NextScript } from "next/document";

import { lato } from "@/pages/_app";

export default function Document() {
  return (
    <Html>
      <Head />
      <body className={lato.className}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
