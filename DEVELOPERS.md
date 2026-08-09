## MPC Autofill Dev Guide

Pre-commit hooks:

- We use pre-commit hooks for enforcing type checks and code styling: https://pre-commit.com/
- CI verifies the hooks pass on the entire codebase
- Install hooks: `pre-commit install`
- The hooks are configured to write changes to files which fail the hooks. The standard workflow is:
  - Attempt to commit some staged changes
  - Styling hooks fail and write the fixes to some files
  - Stage the styling fixes and attempt to commit again

`/schemas`:

- MPC Autofill defines cross-domain data structures in JSON schemas and uses Quicktype to generate Python and TypeScript code for them.
- The JSON schema files are the authority on these data structures, and generated code must not be modified by hand.
- Generate code for JSON schemas: `npm run build`

`/frontend`:

- The frontend is a standard Next.js application (statically generated):
  - Requires Node `22.15` as of August 2026 - authority is frontend GitHub Actions
  - Install dependencies: `npm install`
  - Run the dev server: `npm run dev`
  - Run the tests:
    - Unit tests: `npm run test`
    - Playwright (end-to-end) tests: `npm run test-e2e`
    - Update snapshots for each of the above: `test-update-snapshot`, `test-e2e-update-snapshot`
  - Build frontend assets: `npm run build`

`/MPCAutofill`:

- The backend is a standard Django application:
  - Requires Python 3.13 as of August 2026 - authority is backend Dockerfile
  - Set up your virtual environment: `python -m venv venv` -> `source venv/bin/activate`
  - Install dependencies: `pip install -r requirements.txt`
  - Run the dev server: `python manage.py runserver`
  - Run migrations: `python manage.py migrate`
  - Generate a migration: `python manage.py makemigrations`

`/desktop-tool`:

- The desktop tool is a Click CLI compiled for distrubution with Nuitka:
  - Requires Python 3.13 as of August 2026 - authority is desktop tool GitHub Actions
  - Set up your virtual environment: `python -m venv venv` -> `source venv/bin/activate`
  - Install dependencies: `pip install -r requirements.txt`
  - Run: `python autofill.py`
  - Build: `python -m nuitka autofill.py` (slow, you probably don't need to do this!)

`/image-cdn`:

- The image CDN is a TypeScript-based Cloudflare Worker:
  - Install dependencies: `npm install`
  - Run the dev server: `npm run dev`
  - Run the tests: `npm run test`
