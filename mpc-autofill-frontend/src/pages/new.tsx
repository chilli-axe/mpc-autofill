import Head from "next/head";
import Layout from "@/features/ui/layout";
import Footer from "@/features/ui/footer";

export default function New() {
  return (
    <>
      <Head>
        <title>MPC Autofill New Cards</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <h1>Test</h1>
        <p>Should be my new page</p>
      </Layout>
      <Footer />
    </>
  );
}