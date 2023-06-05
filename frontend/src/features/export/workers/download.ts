import { expose } from "threads/worker";

import { GoogleDriveImageAPIURL } from "@/common/constants";

expose(async function download(identifier: string) {
  const response = await fetch(GoogleDriveImageAPIURL + `?id=${identifier}`, {
    method: "GET",
    credentials: "same-origin",
  });
  return await response.text();
});
