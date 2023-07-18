import Head from "next/head";

import { ProjectName } from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { NewCards } from "@/features/new/new";
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";
import { NoBackendDefault } from "@/features/ui/noBackendDefault";

function NewOrDefault() {
  const backendURL = useAppSelector(selectBackendURL);
  return backendURL != null ? (
    <>
      <h1>What&apos;s New?</h1>
      <NewCards />
      <Footer />
    </>
  ) : (
    <NoBackendDefault />
  );
}

export default function New() {
  // TODO: looks like we're hitting /info every time we switch to a different page
  return (
    <>
      <Head>
        <title>{ProjectName} New Cards</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <NewOrDefault />
      </Layout>
    </>
  );
}
