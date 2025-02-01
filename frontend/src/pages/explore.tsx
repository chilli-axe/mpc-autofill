import Head from "next/head";
import React from "react";

import { NoBackendDefault } from "@/components/NoBackendDefault";
import { Explore as ExploreComponent } from "@/features/explore/Explore";
import { ProjectContainer } from "@/features/ui/Layout";
import { useBackendConfigured } from "@/store/slices/backendSlice";

function ExploreOrDefault() {
  const backendConfigured = useBackendConfigured();
  return backendConfigured ? <ExploreComponent /> : <NoBackendDefault />;
}

export default function Explore() {
  return (
    <ProjectContainer gutter={0}>
      <Head>
        <title>Explore</title>{" "}
        <meta
          name="description"
          // content={`${ProjectName}&apos;'s rich project editor.`}
        />
      </Head>
      <ExploreOrDefault />
    </ProjectContainer>
  );
}
