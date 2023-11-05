import Head from "next/head";

import App from "@/app/app";
import { ProjectName } from "@/common/constants";
import { NoBackendDefault } from "@/components/noBackendDefault";
import { useBackendConfigured } from "@/features/backend/backendSlice";
import { ProjectContainer } from "@/features/ui/layout";
require("bootstrap-icons/font/bootstrap-icons.css");

function AppOrDefault() {
  const backendConfigured = useBackendConfigured();
  return backendConfigured ? <App /> : <NoBackendDefault />;
}

export default function Editor() {
  return (
    <ProjectContainer gutter={0}>
      <Head>
        <title>Edit MPC Project</title>{" "}
        {/* TODO: set this to the project title */}
        <meta
          name="description"
          content={`${ProjectName}&apos;'s rich project editor.`}
        />
      </Head>
      <AppOrDefault />
    </ProjectContainer>
  );
}
