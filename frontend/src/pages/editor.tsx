import Head from "next/head";

import { ProjectName } from "@/common/constants";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import ProjectEditor from "@/components/ProjectEditor";
import { ProjectContainer } from "@/features/ui/Layout";
import { useAnyBackendConfigured } from "@/store/slices/backendSlice";
require("bootstrap-icons/font/bootstrap-icons.css");

function ProjectEditorOrDefault() {
  const anyBackendConfigured = useAnyBackendConfigured();
  return anyBackendConfigured ? <ProjectEditor /> : <NoBackendDefault />;
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
