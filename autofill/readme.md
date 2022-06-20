# MPC Autofill Desktop Client

## Overview
This tool ingests XML files generated with this project's web component, and:

* Downloads the images in your order from Google Drive,
* Uses Selenium (browser automation) to automatically populate your order with [MakePlayingCards.com](https://makeplayingcards.com).

Once the autofilling process completes, you can either complete and pay for your order or save it to your MPC account to purchase/modify later.

## User Guide
### Windows
* Download the latest Windows release from [the Releases tab](https://github.com/chilli-axe/mpc-autofill/releases),
* Move the executable file into the same directory as your XML order,
* Double-click the executable to run. If you have multiple XML files in the directory, you will be prompted to select one.
* If text doesn't seem to render properly (bold text and progress bars don't work), try right-clicking on the window, opening Properties, and setting the font to `Cascadia Mono`. You may also want to configure `cmd.exe` to default to this font.

### macOS and Linux
* Download the latest macOS or Linux release from [the Releases tab](https://github.com/chilli-axe/mpc-autofill/releases),
* Move the executable file into the same directory as your XML order,
* Your computer will probably not recognise the file as an executable, preventing you from double-clicking it on macOS and from running it in the Terminal in Linux. [This guide by Apple](https://support.apple.com/en-au/guide/terminal/apdd100908f-06b3-4e63-8a87-32e71241bab4/mac) has further information on the topic. Fixing it is easy:
  * Open the Terminal (on macOS, this is located in `Applications/Utilities`),
  * Navigate to the directory you moved the executable to (using `cd` - for example, if you moved it to your desktop, run `cd ~/Desktop`),
  * Run the following command: `chmod +x autofill` (this marks the file as an executable),
  * You can now run the tool in macOS by double-clicking on it and in Linux by running `./autofill` in the Terminal. If you have multiple XML files in the directory, you will be prompted to select one.
* You may have issues with running the executable on older versions of macOS [due to a limitation of PyInstaller](https://stackoverflow.com/questions/49908236/pyinstaller-executable-fails-on-old-os-x). GitHub is configured to compile the tool for Windows, macOS, and Linux (Ubuntu) on the latest available version of each operating system.

## Editing Existing Projects
By default, the tool will create the order as a new MPC project. The tool also supports continuing with saved MPC projects - run the program with the command line argument `--skipsetup` to use this functionality. You will be prompted to log into MPC, navigate to a saved project, and continue editing it before the program will continue.

Some notes on how editing an existing project with `--skipsetup` works:
* The project's bracket and quantity will be automatically adjusted according to the XML being processed,
* Any slots which have already been filled will not be refilled,
* If an image is now allocated to more slots, the tool will fill the unfilled slots with the image from the first filled slot for that image.

## Specifying Browser
By default, the tool will configure a driver for Google Chrome. The three major Chromium-based browsers are supported (Chrome, Edge, and Brave), and you can specify which browser should be used to configure the driver with the `--browser` command line argument.

## Developer Guide
### Running the Source Code
From the base repo directory:
* `cd autofill`,
* Activate virtual environment or create one with `venv`,
* Install requirements - `pip install -r requirements.txt`,
* Run the tool - `python autofill.py`.

### Packaging with PyInstaller
From the base repo directory:
* `cd autofill`,
* Activate virtual environment or create one with `venv`,
* Install requirements - `pip install -r requirements.txt`,
* Build with PyInstaller - `pyinstaller autofill.spec`,
* The resultant executable will be in `/autofill/dist`.

### Running the Test Suite
Two tests in `src/tests.py` (at the bottom of the file) are marked as skip as they don't work consistently in GitHub Actions. I suggest commenting out the `pytest.mark.skip()` lines when running tests on your machine to run these. Note that they can take a couple of minutes to run as they put through small orders with MPC.
From the base repo directory:
* `cd autofill`,
* Activate virtual environment or create one with `venv`,
* Install requirements - `pip install -r requirements.txt`,
* `cd src`,
* Run tests - `coverage run -m pytest tests.py`,
* Report on code coverage: `coverage report`.
