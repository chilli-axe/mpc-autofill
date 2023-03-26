import Layout from "./../components/layout";
import { Provider } from "react-redux";
import App from "./../app/app";
import store from "./../app/store";
import Head from "next/head";
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
        <Provider store={store}>
          <App />
        </Provider>
      </Layout>
    </>
  );
}
