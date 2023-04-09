import Head from "next/head";
import Layout from "@/features/ui/layout";
import Footer from "@/features/ui/footer";
import { ProjectName } from "@/common/constants";
import { Contributions as ContributionsComponent } from "@/features/contributions/contributions";

export default function Contributions() {
  return (
    <>
      <Head>
        <title>{ProjectName} Contributions</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <ContributionsComponent />
        <Footer />
      </Layout>
    </>
  );
}
