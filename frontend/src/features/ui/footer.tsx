import Link from "next/link";

import { useGetBackendInfoQuery } from "@/app/api";

function Spacer() {
  return (
    <span style={{ marginLeft: 0.25 + "em", marginRight: 0.25 + "em" }}> </span>
  );
}

export default function Footer() {
  const backendInfoQuery = useGetBackendInfoQuery();
  return (
    <>
      <hr />
      <footer className="page-footer font-small blue">
        <div className="footer-copyright text-center py-3">
          <a href="https://github.com/chilli-axe/mpc-autofill" target="_blank">
            GitHub
          </a>
          {backendInfoQuery.data?.reddit != null && (
            <>
              <Spacer />•<Spacer />
              <a href={backendInfoQuery.data.reddit} target="_blank">
                Reddit
              </a>
            </>
          )}
          {backendInfoQuery.data?.discord != null && (
            <>
              <Spacer />•<Spacer />
              <a href={backendInfoQuery.data.discord} target="_blank">
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
