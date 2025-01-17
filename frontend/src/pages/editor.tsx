import Head from "next/head";

import { ProjectName } from "@/common/constants";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import ProjectEditor from "@/components/ProjectEditor";
import { useBackendConfigured } from "@/features/backend/backendSlice";
import { ProjectContainer } from "@/features/ui/Layout";
require("bootstrap-icons/font/bootstrap-icons.css");

function ProjectEditorOrDefault() {
  const backendConfigured = useBackendConfigured();
  return backendConfigured ? <ProjectEditor /> : <NoBackendDefault />;
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
      <ProjectEditorOrDefault />
    </ProjectContainer>
  );
}
