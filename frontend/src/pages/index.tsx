import Head from "next/head";

import { ProjectName } from "@/common/constants";
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";

export default function Index() {
  return (
    <>
      <Head>
        <title>{ProjectName}</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <h1>Index</h1>
        <p>Under construction</p>
        <Footer />
      </Layout>
    </>
  );
}
