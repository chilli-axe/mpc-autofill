import Head from "next/head";
import React from "react";

import { ProjectName } from "@/common/constants";
import { DynamicLogo } from "@/features/ui/dynamicLogo";
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
        <br />
        <DynamicLogo />
        <Footer />
      </Layout>
    </>
  );
}
