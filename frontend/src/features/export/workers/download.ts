import { expose } from "threads/worker";

expose(async function download(identifier: string) {
  const response = await fetch(
    `https://script.google.com/macros/s/AKfycbw8laScKBfxda2Wb0g63gkYDBdy8NWNxINoC4xDOwnCQ3JMFdruam1MdmNmN4wI5k4/exec?id=${identifier}`,
    { method: "GET", credentials: "same-origin" }
  );
  return await response.text();
});
