import Head from "next/head";
import Layout from "@/features/ui/layout";
import Footer from "@/features/ui/footer";

export default function Guide() {
  return (
    <>
      <Head>
        <title>MPC Autofill Guide</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <h1>Test</h1>
        <p>Should be my guide page</p>
      </Layout>
      <Footer />
    </>
  );
}
