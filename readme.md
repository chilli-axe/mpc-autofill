![build_desktop_tool](https://github.com/chilli-axe/mpc-autofill/actions/workflows/build_desktop_tool.yml/badge.svg)
![build_frontend](https://github.com/chilli-axe/mpc-autofill/actions/workflows/build_frontend.yml/badge.svg)
![tests](https://github.com/chilli-axe/mpc-autofill/actions/workflows/tests.yml/badge.svg)
[![Github all releases](https://img.shields.io/github/downloads/chilli-axe/mpc-autofill/total.svg)](https://GitHub.com/chilli-axe/mpc-autofill/releases/)
[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=7LJNRSLJYCZTJ&currency_code=AUD&source=url)

# mpc-autofill

Automating MakePlayingCards' online ordering system.

<img align="right" width="64px" src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg" alt="JetBrains Logo (Main) logo.">

If you're here to download the desktop client, check the [Releases]("https://github.com/chilli-axe/mpc-autofill/releases") tab.

JetBrains supports this project's development through their [Open Source Development licensing](https://jb.gg/OpenSourceSupport).

# Monorepo Structure

Each component of the project has its own README; check those out for more details.

## Backend

- Located in `/MPCAutofill`.
- **Note**: The frontend in this section of the codebase is considered deprecated and no new features will be added to it.
  - See `/frontend` for the successor to this part of the project.
- Images stored in the Google Drives connected to the project are indexed in Elasticsearch.
- The backend server is decoupled from `/frontend` and the frontend allows users to configure which backend to retrieve data from.
- Stack:
  - Backend:
    - Django 4, the database of your choosing (sqlite is fine), Elasticsearch 7.x, and Google Drive API integration.
  - Frontend (deprecated):
    - jQuery + jQuery UI, Bootstrap 5, Webpack + Babel for compilation and bundling.
- Facilitates the generation of XML orders for use with the desktop client.
- Intended to be deployed natively in a Linux VM but can also be spun up locally with Docker.

## Frontend

- **Note**: At time of writing, this component of the project is not yet stable. Please continue to use the legacy frontend in `/MPCAutofill` for a stable frontend experience.
- Located in `/frontend`.
- A web app that communicates with a specified MPC Autofill backend (hosted somewhere on the Internet) and facilitates the creation, customisation, and exporting of projects with drives linked to that backend.
- Stack:
  - Static Next.js web app built with Typescript, React-Bootstrap, and Redux.
  - Automatically deployed on GitHub Pages to `mpcautofill.github.io` whenever changes are made to the `frontend-release` branch.

## Desktop Client

- Located in `/desktop-tool`.
- Responsible for parsing XML orders, downloading images from Google Drive, and automating MPC's order creation interface.
- Stack:
  - A Click CLI which is compiled and distributed (in GitHub Releases) as an executable with Pyinstaller.

# Contributing

- Please ensure that you install the `pre-commit` Python package and run `pre-commit install` before committing any code to your branch / PR - this will run various linting, code styling, and static type checking tools to validate your code.
- GitHub Actions is configured in this repository to run the Django project's end-to-end tests. To run these, it needs to access the Google Drive API, and does so through a repository secret named `GOOGLE_DRIVE_API_KEY`. If you fork this project, you'll need to set this repository secret for GitHub Actions to run these tests for you.
  - **Note**: If you create a pull request to this repository from your fork and you don't follow this step, your CI build will fail! Don't worry about it unless you're modifying backend code with test coverage.
