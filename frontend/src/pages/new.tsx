import Head from "next/head";

import { useAppSelector } from "@/common/types";
import {
  selectBackendURL,
  useProjectName,
} from "@/features/backend/backendSlice";
import { NewCards } from "@/features/new/new";
import Footer from "@/features/ui/footer";
import { ProjectContainer } from "@/features/ui/layout";
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
  const projectName = useProjectName();
  return (
    <ProjectContainer>
      <Head>
        <title>{projectName} New Cards</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <NewOrDefault />
    </ProjectContainer>
  );
}
