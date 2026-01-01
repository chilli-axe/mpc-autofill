import Head from "next/head";
import React from "react";

import { NoBackendDefault } from "@/components/NoBackendDefault";
import { Explore as ExploreComponent } from "@/features/explore/Explore";
import { ProjectContainer } from "@/features/ui/Layout";
import { useRemoteBackendConfigured } from "@/store/slices/backendSlice";

function ExploreOrDefault() {
  const remoteBackendConfigured = useRemoteBackendConfigured();
  return remoteBackendConfigured ? (
    <ExploreComponent />
  ) : (
    <NoBackendDefault requirement="remote" />
  );
}

export default function Explore() {
  return (
    <ProjectContainer gutter={0}>
      <Head>
        <title>Explore</title> <meta name="description" />
      </Head>
      <ExploreOrDefault />
    </ProjectContainer>
  );
}
