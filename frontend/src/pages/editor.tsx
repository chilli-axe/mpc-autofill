import Head from "next/head";

import App from "@/app/app";
import { ProjectContainer } from "@/features/ui/layout";
require("bootstrap-icons/font/bootstrap-icons.css");

export default function Editor() {
  return (
    <ProjectContainer gutter={0}>
      <Head>
        <title>Edit MPC Project</title>{" "}
        {/* TODO: set this to the project title */}
        <meta name="description" content="Edit MPC Project" />
      </Head>
      <App />
    </ProjectContainer>
  );
}
