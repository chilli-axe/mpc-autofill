import Head from "next/head";
import React from "react";

import { ProjectName } from "@/common/constants";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import { NewCards } from "@/features/new/New";
import Footer from "@/features/ui/Footer";
import { ProjectContainer } from "@/features/ui/Layout";
import {
  useProjectName,
  useRemoteBackendConfigured,
} from "@/store/slices/backendSlice";

function NewOrDefault() {
  const remoteBackendConfigured = useRemoteBackendConfigured();
  return remoteBackendConfigured ? (
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
  const projectName = useProjectName();
  return (
    <ProjectContainer>
      <Head>
        <title>{`${projectName} New Cards`}</title>
        <meta
          name="description"
          content={`Check out the new cards added to ${ProjectName} over the last two weeks.`}
        />
      </Head>
      <NewOrDefault />
    </ProjectContainer>
  );
}
