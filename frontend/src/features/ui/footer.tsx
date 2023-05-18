import Link from "next/link";
import { useSelector } from "react-redux";

import { useGetBackendInfoQuery } from "@/app/api";
import { selectBackendURL } from "@/features/backend/backendSlice";

function Spacer() {
  return (
    <span style={{ marginLeft: 0.25 + "em", marginRight: 0.25 + "em" }}> </span>
  );
}

export default function Footer() {
  const backendURL = useSelector(selectBackendURL);
  const backendInfoQuery = useGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });
  return (
    <>
      <hr />
      <footer className="page-footer font-small blue">
        <div className="footer-copyright text-center py-3">
          <a href="https://github.com/chilli-axe/mpc-autofill" target="_blank">
            GitHub
          </a>
          {backendInfoQuery.isSuccess && backendInfoQuery.data?.reddit != null && (
            <>
              <Spacer />•<Spacer />
              <a href={backendInfoQuery.data.reddit} target="_blank">
                Reddit
              </a>
            </>
          )}
          {backendInfoQuery.isSuccess &&
            backendInfoQuery.data?.discord != null && (
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
