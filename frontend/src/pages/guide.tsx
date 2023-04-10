import Head from "next/head";
import Layout from "@/features/ui/layout";
import Footer from "@/features/ui/footer";
import { ProjectName } from "@/common/constants";

export default function Guide() {
  return (
    <>
      <Head>
        <title>{ProjectName} Guide</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <h1>Guide</h1>
        <p>Under construction</p>
        <Footer />
      </Layout>
    </>
  );
}
