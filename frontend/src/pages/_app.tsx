import "./../styles/styles.scss";
import "./../styles/custom.css";
import { AppProps } from "next/app";
import { lato } from "@/app/font";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${lato.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
