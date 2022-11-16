![build](https://github.com/chilli-axe/mpc-autofill/actions/workflows/build.yml/badge.svg)
![tests](https://github.com/chilli-axe/mpc-autofill/actions/workflows/tests.yml/badge.svg)
[![Github all releases](https://img.shields.io/github/downloads/chilli-axe/mpc-autofill/total.svg)](https://GitHub.com/chilli-axe/mpc-autofill/releases/)
[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=7LJNRSLJYCZTJ&currency_code=AUD&source=url)

# mpc-autofill

Automating MakePlayingCards' online ordering system.

<img align="right" width="64px" src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg" alt="JetBrains Logo (Main) logo.">

If you're here to download the desktop client, check the [Releases]("https://github.com/chilli-axe/mpc-autofill/releases") tab.

JetBrains supports this project's development through their [Open Source Development licensing](https://jb.gg/OpenSourceSupport).

# Monorepo Structure

- Web project:
  - Located in `/MPCAutofill`,
  - Images stored in the Google Drives connected to the project are indexed in Elasticsearch,
  - Stack:
    - Backend:
      - Django 4,
      - The database of your choosing (Elasticsearch is fine),
      - Elasticsearch 7.x,
      - Google Drive API integration,
    - Frontend:
      - jQuery + jQuery UI,
      - Bootstrap 5,
      - Webpack + Babel for compiling and bundling the frontend,
  - Facilitates the generation of XML orders for use with the desktop client,
  - Intended to be deployed as a web application but can also be spun up locally with Docker.
- Desktop client:
  - Located in `/autofill`,
  - Responsible for parsing XML orders, downloading images from Google Drive, and automating MPC's order creation interface.

Each component of the project has its own README; check those out for more details.

# Requirements

- Python 3.9+ and the packages specified in `requirements.txt` for each component (web project and desktop client).

# Contributing

- Please ensure that you install the `pre-commit` Python package and run `pre-commit install` before committing any code to your branch / PR - this will run `black` and `isort` on your code to maintain consistent styling, and run `mypy` to catch any static typing issues.
- GitHub Actions is configured in this repository to run the Django project's end-to-end tests. To run these, it needs to access the Google Drive API, and does so through a repository secret named `GOOGLE_DRIVE_API_KEY`. If you fork this project, you'll need to set this repository secret for GitHub Actions to run these tests for you.
