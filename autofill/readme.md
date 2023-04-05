# MPC Autofill Desktop Client

## Overview

This tool ingests XML files generated with this project's web component, and:

- Downloads the images in your order from Google Drive (into the directory `/cards` from the executable's location),
- Uses Selenium (browser automation) for Chromium browsers to automatically populate your order with [MakePlayingCards.com](https://makeplayingcards.com).

Once the autofilling process completes, you can either complete and pay for your order or save it to your MakePlayingCards account to purchase/modify later.

**Note**: Automated Chromium browsers do not support signing in with Google accounts for security reasons; you will need to create an account with MakePlayingCards directly and sign in with it.

## User Guide

### Windows

- Download the latest Windows release from [the Releases tab](https://github.com/chilli-axe/mpc-autofill/releases),
- Move the executable file into the same directory as your XML order,
- Double-click the executable to run. If you have multiple XML files in the directory, you will be prompted to select one. **Do not** run it by dragging your XML file onto it.
- If text doesn't seem to render properly (bold text and progress bars don't work), try right-clicking on the window, opening Properties, and setting the font to `Cascadia Mono`. You may also want to configure `cmd.exe` to default to this font.

### macOS and Linux

- Download the latest macOS or Linux release from [the Releases tab](https://github.com/chilli-axe/mpc-autofill/releases),
- Your computer will probably not recognise the file as an executable, preventing you from double-clicking it on macOS and from running it in the Terminal in Linux. [This guide by Apple](https://support.apple.com/en-au/guide/terminal/apdd100908f-06b3-4e63-8a87-32e71241bab4/mac) has further information on the topic. Fixing it is easy:
  - On **macOS**:
    - Put `autofill-macos` and your XML file on your desktop
    - Open the Terminal (this is located in `Applications/Utilities`),
    - Type the following commands into the terminal window, one at a time (you can copy and paste them from here):
      - `cd ~/Desktop`
      - `chmod +x autofill-macos`
    - Run the tool by double-clicking it. **Do not** run it by dragging your XML file onto it.
  - On **Linux**:
    - Put `autofill-linux` and your XML file on your desktop
    - Open the Terminal,
    - Type the following commands into the terminal window, one at a time (you can copy and paste them from here):
      - `cd ~/Desktop`
      - `chmod +x autofill-linux`
      - `./autofill-linux`
- You may have issues with running the executable on older versions of macOS [due to a limitation of PyInstaller](https://stackoverflow.com/questions/49908236/pyinstaller-executable-fails-on-old-os-x). GitHub is configured to compile the tool for Windows, macOS, and Linux (Ubuntu) on the latest available version of each operating system.

### Editing Existing Projects

By default, the tool will create the order as a new MPC project. The tool also supports continuing with saved MPC projects - run the program with the command line argument `--skipsetup` to use this functionality. You will be prompted to log into MPC, navigate to a saved project, and continue editing it before the program will continue.

Some notes on how editing an existing project with `--skipsetup` works:

- The project's bracket and quantity will be automatically adjusted according to the XML being processed,
- Any slots which have already been filled will not be refilled,
- If an image is now allocated to more slots, the tool will fill the unfilled slots with the image from the first filled slot for that image.

### Specifying a Browser

By default, the tool will configure a driver for Google Chrome. The three major Chromium-based browsers are supported (Chrome, Edge, and Brave), and you can specify which browser should be used to configure the driver with the `--browser` command line argument.

### Exporting to PDF

You can optionally export the downloaded images to a PDF which can be uploaded to a card printing site by using the `--exportpdfs` command line argument. Once the images are downloaded, press enter and you'll be presented with a few questions. If you plan to upload the PDFs to MakePlayingCards, select `yes` when asked about storing the separate faces in their own PDF. If you plan to use DriveThruCards, select `no` for that question, and then set the number of cards to include per exported file. If using DriveThruCards, be aware that they have a file size upload limit of 1gb, so depending on the file size of the selected images, your order may need to be set to a lower number, like 30 or 40 cards.

### Preventing Sleep

By default the system is prevented from falling asleep during execution. This might require sudo/admin permissions on linux. System sleep during execution can be allowed with the `--allowsleep` command line argument.

## Developer Guide

### Running the Source Code

From the base repo directory:

- `cd autofill`,
- Activate virtual environment or create one with `venv`,
- Install requirements - `pip install -r requirements.txt`,
- Run the tool - `python autofill.py`.

### Packaging with PyInstaller

From the base repo directory:

- `cd autofill`,
- Activate virtual environment or create one with `venv`,
- Install requirements - `pip install -r requirements.txt`,
- Build with PyInstaller - `pyinstaller autofill.spec`,
- The resultant executable will be in `/autofill/dist`.

### Running the Test Suite

Two tests in `tests/test_desktop_client.py` (at the bottom of the file) are marked as skip as they don't work consistently in GitHub Actions. I suggest commenting out the `pytest.mark.skip()` lines when running tests on your machine to run these. Note that they can take a couple of minutes to run as they put through small orders with MPC.
From the base repo directory:

- `cd autofill`,
- Activate virtual environment or create one with `venv`,
- Install requirements - `pip install -r requirements.txt`,
- `cd tests`,
- Run tests - `coverage run -m pytest test_desktop_client.py`,
- Report on code coverage: `coverage report`.

### XML Specification

The tool expects XML files to follow a strict schema as described below.

#### Example

```xml
<order>
    <details>
        <quantity>6</quantity>
        <bracket>18</bracket>
        <stock>(S30) Standard Smooth</stock>
        <foil>false</foil>
    </details>
    <fronts>
        <card>
            <id>1wlrM7pNHQ5NqS9GY5LWH7Hd04TtNgHI4</id>
            <slots>0,1,2,3</slots>
            <name>Rite of Flame.png</name>
            <query>rite of flame</query>
        </card>
           <card>
            <id>1Sy9Me6fD3Kt6eWpN_RX3tGo2DqgUHFwa</id>
            <slots>4,5</slots>
            <name>0. Huntmaster of the Fells.png</name>
            <query>huntmaster of the fells</query>
        </card>
    </fronts>
    <backs>
        <card>
            <id>1M7LJMlEmYumq8QtiYt1HNfJt1Zmi1Y9j</id>
            <slots>4,5</slots>
            <name>0. Ravager of the Fells.png</name>
            <query>ravager of fells</query>
        </card>
    </backs>
    <cardback>C:\Users\chilli-axe\Desktop\cardback.png</cardback>
</order>
```

#### Order Details

- Defined in the `details` tag as:
  - `quantity` - total number of cards in the order. Must be less than or equal to `bracket`.
  - `bracket` - the MPC bracket the order falls into - e.g. ordering 6 cards falls into the bracket of "up to 18 cards". Valid options at time of writing are `18`, `36`, `55`, `72`, `90`, `108`, `126`, `144`, `162`, `180`, `198`, `216`, `234`, `396`, `504`, and `612`.
  - `stock` - the selected cardstock. Valid options are `(S30) Standard Smooth`, `(S33) Superior Smooth`, `(M31) Linen`, and `(P10) Plastic`.
  - `foil` - whether the card fronts should be holographic. Valid options are `true` or `false`.

#### Cards

- Card fronts are defined in the `fronts` tag, and card backs are optionally defined in the `backs` tag (as in, your XML will still be valid if it does not contain the `backs` tag, and only defines `fronts`).
- `fronts` and `backs` should each contain a number of `card` elements.
- Each `card` element is defined as:
  - `id` - can contain a filepath on the computer running the tool or a Google Drive file ID.
  - `slots` - A comma-separated list of the slots within the card's face that this image should be filled into.
  - `name` - The name of the file. If a file with this name exists in the `cards` directory, the tool will use this file rather than downloading the file from Google Drive. This field is **optional** for the desktop client.
  - `query` - The query which returned this image in the web component. This enables re-uploading an existing XML to continue editing, and is **optional** for the desktop client.

#### Cardback

- The `cardback` tag contains a reference to a single image which is allocated to the backs of any cards which don't have back images defined in `backs`.
- Functions identically to the `id` tag in `cards` - if the value is a filepath, the tool will use that file; otherwise, it will treat the value as a Google Drive file ID and attempt to download it from Google Drive.
