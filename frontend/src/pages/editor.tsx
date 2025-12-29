import Head from "next/head";

import { ProjectName } from "@/common/constants";
import ProjectEditor from "@/components/ProjectEditor";
import { ProjectContainer } from "@/features/ui/Layout";
require("bootstrap-icons/font/bootstrap-icons.css");

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
      <ProjectEditor />
    </ProjectContainer>
  );
}
