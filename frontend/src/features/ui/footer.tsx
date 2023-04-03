import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

function Spacer() {
  return (
    <span style={{ marginLeft: 0.25 + "em", marginRight: 0.25 + "em" }}> </span>
  );
}

export default function Footer() {
  const backendReddit = useSelector(
    (state: RootState) => state.backend.info?.reddit
  );
  const backendDiscord = useSelector(
    (state: RootState) => state.backend.info?.discord
  );
  return (
    <>
      <hr />
      <footer className="page-footer font-small blue">
        <div className="footer-copyright text-center py-3">
          <a href="https://github.com/chilli-axe/mpc-autofill" target="_blank">
            GitHub
          </a>
          {backendReddit != null && (
            <>
              <Spacer />•<Spacer />
              <a href={backendReddit} target="_blank">
                Reddit
              </a>
            </>
          )}
          {backendDiscord != null && (
            <>
              <Spacer />•<Spacer />
              <a href={backendDiscord} target="_blank">
                Discord
              </a>
            </>
          )}
          <Spacer />•<Spacer />
          <Link href="/about">About</Link>
        </div>
      </footer>
    </>
  );
}
