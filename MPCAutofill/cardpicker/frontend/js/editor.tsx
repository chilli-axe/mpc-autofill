import * as React from "react";
import App from "./editor/app/App";
import store from "./editor/app/store";
import { Provider } from "react-redux";
import * as ReactDOMClient from "react-dom/client";

import "../scss/styles.scss";
import "../css/custom.css";

// require("./base.js");
// require("bootstrap/js/dist/dropdown");
require("bootstrap-icons/font/bootstrap-icons.css");

const root = ReactDOMClient.createRoot(
  document.getElementById("app") as HTMLElement
);
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
