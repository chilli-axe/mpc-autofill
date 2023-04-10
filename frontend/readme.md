# MPC Autofill Frontend

## NOTE: This section of the project is in alpha state! Don't be surprised if you find incomplete features, bugs, and/or performance issues.

## Overview

- The MPC Autofill frontend integrates with the backend (in `/MPCAutofill`) as a decoupled deployment.
  - That is, the frontend is statically hosted on GitHub and any backend server deployed on the Internet can be connected to it.
  - The app is automatically deployed on GitHub Pages to `mpcautofill.github.io` whenever changes are made to the `frontend-release` branch.
- It facilitates the creation and management of projects which can be automatically sent to MakePlayingCards.com using the desktop tool CLI (in `/desktop-tool).
- Users can:
  - Add cards to their project through various methods (e.g. text, URL).
  - Browse the available versions of each card and change the selected card for each slot.
  - Finely control the search results they see through a search settings interface.
  - Export the project in a format readable by the desktop tool.
  - Browse new cards added to the connected backend and review a summary of all sources configured in the backend.

## Stack

- The MPC Autofill frontend is a Next.js web application built with TypeScript, react-bootstrap, and Redux.
- It's completely static - i.e. deployed as HTML/CSS/JS with no backend server - and communicates with a backend server as configured through the GUI.

## Local Environment Setup

- Follow these steps if you're looking to contribute to this repo or otherwise want to set up MPC Autofill on your machine.
- You will also need to follow the steps for the backend (in `/MPCAutofill`) for a complete environment.
- From a clean installation of your OS of choice, you will need:
  - The latest version of `npm`.
  - As described in the root-level README doc, you will need the latest version of the Python `pre-commit` package.
  - The web browser of your choice.

1. Install the project's pre-commit hooks. In the root directory:

```text
pre-commit install
```

- The pre-commit hooks will lint and format your code whenever you commit a change.

2. Set up your environment variables. Copy the `.env.dist` file as a new file called `.env.local` and configure it according to the table in the next section.

3. Within the `/frontend` folder, install the project dependencies:

```text
npm install
```

4. Run the development server:

```text
npm run dev
```

- This will spin up a server hosting the frontend at `localhost:3000`.

5. When you've made some changes, run the tests and build the project with Next.js:

```text
npm run test
npx next build
```

## Environment Variables

Relevant Next.js docs: https://nextjs.org/docs/basic-features/environment-variables

A summary of the environment variables used in this project and their purposes is below:

| Name                            | Description                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Your _Google Analytics measurement id_. <br/>Used by the [`nextjs-google-analytics`](https://github.com/MauricioRobayo/nextjs-google-analytics) package. |
