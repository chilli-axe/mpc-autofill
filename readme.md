![build](https://github.com/chilli-axe/mpc-autofill/actions/workflows/build.yml/badge.svg)
![tests_black_isort_mypy](https://github.com/chilli-axe/mpc-autofill/actions/workflows/tests_black_isort_mypy.yml/badge.svg)
[![Github all releases](https://img.shields.io/github/downloads/chilli-axe/mpc-autofill/total.svg)](https://GitHub.com/chilli-axe/mpc-autofill/releases/)

# mpc-autofill

Automating MakePlayingCards's online ordering system.

If you're here to download the desktop client, check the [Releases](https://github.com/chilli-axe/mpc-autofill/releases) tab.

# Monorepo Structure
* Web project:
  * Located in `/MPCAutofill`,
  * Backend is Django 4 with Elasticsearch (sqlite is fine), frontend is Jquery,
  * Indexes images stored in the Google Drives connected to the project,
  * Facilitates the generation of XML orders for use with the desktop client,
  * Intended to be deployed as a web application but can also be spun up locally with Docker.
* Desktop client:
  * Located in `/autofill`,
  * Responsible for parsing XML orders, downloading images from Google Drive, and automating MPC's order creation interface.

Each component of the project has its own README; check those out for more details.

# Requirements
* Python 3.9+ and the packages specified in `requirements.txt` for each component (web project and desktop client).

# Contributing
* Please ensure that you install the `pre-commit` Python package and run `pre-commit install` before committing any code to your branch / PR - this will run `black` and `isort` on your code to maintain consistent styling, and run `mypy` to catch any static typing issues.
* GitHub Actions is configured in this repository to run the Django project's end-to-end tests. To run these, it needs to access the Google Drive API, and does so through a repository secret named `GOOGLE_DRIVE_API_KEY`. If you fork this project, you'll need to set this repository secret for GitHub Actions to run these tests for you.
