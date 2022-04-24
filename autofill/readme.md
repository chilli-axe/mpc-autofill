# MPC Autofill Desktop Client

## Overview
This tool ingests XML files generated with this project's web component, and:

* Downloads the images in your order from Google Drive,
* Uses Selenium (browser automation) to automatically populate your order with [MakePlayingCards.com](https://makeplayingcards.com).

Once the autofilling process completes, you can either complete and pay for your order or save it to your MPC account to purchase/modify later.

# Windows Guide
* Download the latest Windows release from [the Releases tab](https://github.com/chilli-axe/mpc-autofill/releases),
* Move the executable file into the same directory as your XML order,
* Double-click the executable to run. If you have multiple XML files in the directory, you will be prompted to select one.
* If text doesn't seem to render properly (bold text and progress bars don't work), try right-clicking on the window, opening Properties, and setting the font to `Cascadia Mono`.

# macOS and Linux Guide
* Download the latest macOS or Linux release from [the Releases tab](https://github.com/chilli-axe/mpc-autofill/releases),
* Your computer will probably not recognise the file as an executable, preventing you from double-clicking it on macOS and from running it in the Terminal in Linux. Fixing this is easy:
  * Move the file to your desktop,
  * Open the Terminal (on macOS, this is located under Applications/Utilities),
  * Run the following command: `chmod +x autofill`, which marks the file as an executable,
  * You can now run the tool in macOS by double-clicking on it and in Linux with `./autofill` in the Terminal.
  * [This guide by Apple](https://support.apple.com/en-au/guide/terminal/apdd100908f-06b3-4e63-8a87-32e71241bab4/mac) has further information on the topic.
* You may have issues with running the executable on older versions of macOS [due to a limitation of PyInstaller](https://stackoverflow.com/questions/49908236/pyinstaller-executable-fails-on-old-os-x). GitHub is configured to compile the tool for Windows, macOS, and Linux (Ubuntu) on the latest available versions.

# Developer Guide
## Running the Source Code
From the base repo directory:
* `cd autofill`,
* activate virtual environment or create one with `venv`,
* `pip install -r requirements.txt`,
* `python autofill.py`.

## Packaging with PyInstaller
From the base repo directory:
* `cd autofill`,
* activate virtual environment or create one with `venv`,
* `pip install -r requirements.txt`,
* pyinstaller autofill.spec,
* The resultant executable will be in `/autofill/dist`.

## Running the Test Suite
This may take a short while as a couple of tests run complete orders with MPC. From the base repo directory:
* `cd autofill`,
* activate virtual environment or create one with `venv`,
* `pip install -r requirements.txt`,
* `cd src`,
* `coverage run -m pytest tests.py`,
* Optionally report on code coverage: `coverage report`.
