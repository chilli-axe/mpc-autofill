import Head from "next/head";
import React from "react";

import { NoBackendDefault } from "@/components/NoBackendDefault";
import { Explore as ExploreComponent } from "@/features/explore/Explore";
import { ProjectContainer } from "@/features/ui/Layout";
import { useAnyBackendConfigured } from "@/store/slices/backendSlice";

function ExploreOrDefault() {
  const anyBackendConfigured = useAnyBackendConfigured();
  return anyBackendConfigured ? (
    <ExploreComponent />
  ) : (
    <NoBackendDefault requirement="any" />
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
