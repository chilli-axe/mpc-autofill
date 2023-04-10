import "./../styles/styles.scss";
import "./../styles/custom.css";
import { AppProps } from "next/app";
import { lato } from "@/app/font";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={lato.className}>
      <Component {...pageProps} />
    </main>
  );
}
