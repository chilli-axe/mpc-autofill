import Head from "next/head";
import Layout from "@/features/ui/layout";
import Footer from "@/features/ui/footer";
import { ProjectName } from "@/common/constants";

export default function Contributions() {
  return (
    <>
      <Head>
        <title>{ProjectName} Contributions</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <h1>Test</h1>
        <p>Should be my contributions page</p>
        <Footer />
      </Layout>
    </>
  );
}
