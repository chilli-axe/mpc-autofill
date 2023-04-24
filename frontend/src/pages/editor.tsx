import Head from "next/head";

import App from "@/app/app";
import Layout from "@/features/ui/layout";
require("bootstrap-icons/font/bootstrap-icons.css");

export default function Editor() {
  return (
    <>
      <Head>
        <title>Edit MPC Project</title>{" "}
        {/* TODO: set this to the project title */}
        <meta name="description" content="Edit MPC Project" />
      </Head>
      <Layout>
        <App />
      </Layout>
    </>
  );
}
