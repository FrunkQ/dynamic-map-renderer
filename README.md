# Dynamic Map Renderer

## Description

The Dynamic Map Renderer is a web-based application designed for tabletop roleplaying games (TTRPGs). It transforms static map images into dynamic displays, allowing a Game Master (GM) to control the map appearance, apply visual effects (filters), and manage the view presented to players in real-time[cite: 3, 85]. This initial release focuses on image-based maps with a retro sci-fi aesthetic[cite: 4] - good for Mothership, Traveller or the Aliens RPG.

![Animation of map](./MapRendererDemo.gif)

## Quick Notes
This is quick early release to see if others would find this useful or interesting to use. I am looking for feedback and suggestions. Much of this was inspired by the amazing work by the Quadra team who created the Tannhauser Remote Desktop for their Warped Beyond Recognition adventure. I just wanted to make a GM driven client-server tool that would work to spruce up an otherwsie bland map. 

I grabbed a couple of example maps to show it working. Both seemed pretty well ditributed across various web sites - so I am not anticipating anyone will mind. That sai, I did not seek permission in advance - so happy to remove them!
USS Pharoah: https://www.failuretolerated.com/mothership-ship-creation-sheet
The Alexis: from DEad Planet: https://www.drivethrurpg.com/en/product/484228/mothership-dead-planet

This project has been "Vibe coded" - a dirty word for many. This means it was not written by me, I just directed Google's Gemini 2.5 Pro (expererimental) to actually write the code from various design docs and development plans. I claim no ownership over the program or code here and anyone can use it for any purpose without permission. If you can let me know what you are using it for that would be cool; just for personal interest.

## Current Features (v0.1.0)

* **Image Map Support:** Load and display `.png`, `.jpg`, `.jpeg`, and `.webp` map files[cite: 89].
* **GM Control Interface:** Web interface for the GM to manage the session[cite: 11].
* **Player View:** Separate web view for players, displaying the GM-controlled map[cite: 13].
* **Visual Filters:** Apply pre-defined visual filters to the map image:
    * Retro Sci-Fi Green [cite: retro_sci_fi_green/config.json]
    * Retro Sci-Fi Amber [cite: retro_sci_fi_amber/config.json]
    * None (Passthrough) [cite: none/config.json]
* **Player View Control:** GM can pan (Center X/Y) and zoom (Scale) the view shown to players[cite: 124].
* **Configuration Saving/Loading:** GM can save and load map configurations (selected filter, parameters, view state) per map image[cite: 126]. Configs are stored as JSON files in the `./configs/` directory[cite: 122].
* **Real-time Updates:** Player views update instantly via WebSockets (Socket.IO) when the GM makes changes[cite: 87, 125].

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone <Your-Repository-URL>
    cd dynamic-map-renderer
    ```
2.  **Create & Activate Virtual Environment: (Optional)**
    It will just work fine from most existing Python environments
    ```bash
    # For Linux/macOS
    python3 -m venv venv
    source venv/bin/activate

    # For Windows
    python -m venv venv
    .\venv\Scripts\activate
    ```
3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Requires Python 3.x)* [cite: 81]
4.  **Run the Application:**
    ```bash
    python app.py
    ```
    The server will start, typically on `http://127.0.0.1:5000/` [cite: app.py].

## Usage

1.  **GM View:** Open `http://127.0.0.1:5000/` in your browser.
    * Upload map images using the "Upload New Map Image" section.
    * Select a map from the "Select Map" dropdown.
    * Choose a filter from the "Select Filter" dropdown.
    * Adjust filter parameters using the sliders/controls that appear.
    * Adjust the Player View using the "Center X/Y" and "Scale" sliders.
    * Click "Save Map Config" to save the current settings for the selected map.
2.  **Player View:** Share the "Player URL" displayed at the bottom of the GM controls panel with your players. For this version, the URL will always be:
    `http://127.0.0.1:5000/player?session=my-game` [cite: 88, app.py]
    Players opening this URL will see the map as controlled by the GM.

## Directory Structure

* `app.py`: Main Flask application and WebSocket server[cite: 23].
* `requirements.txt`: Python dependencies[cite: 1].
* `templates/`: HTML files for GM (`index.html`) and Player (`player.html`) views [cite: index.html, player.html].
* `static/`: CSS (`style.css`) and JavaScript (`gm.js`, `player.js`) files [cite: style.css, gm.js, player.js].
* `maps/`: Directory to store map image files[cite: 18, 91]. (Create if it doesn't exist or if excluded by `.gitignore`).
* `configs/`: Directory to store saved map configuration JSON files[cite: 19, 96]. (Create if it doesn't exist or if excluded by `.gitignore`).
* `filters/`: Contains subdirectories for each filter, holding `config.json` and shader (`.glsl`) files[cite: 121].

## Known Issues / Limitations (v0.1.0)

* **Hardcoded Session ID:** Player sessions currently *must* use the hardcoded session ID `my-game`[cite: 88, 125]. Custom session IDs are not yet supported.
* **No User Management:** Assumes a single GM and potentially multiple players connected to the same session.

## Future Plans

The following features are planned for future releases:

1.  **User-Defined Session IDs:** Allow the GM to create custom, memorable session IDs[cite: 127].
2.  **Fog of War:** Tools for the GM to dynamically hide and reveal parts of the map[cite: 129].
3.  **Marker Functionality:** Allow placing and managing visual markers/icons/tokens on the map[cite: 128].
4.  **Sound Features:** Integrate sound effects or ambient audio tied to the map or markers (eg: Aliens style motion-tracker/sound varies dpending upon player location)[cite: 130].
5.  **Player Window Transitions:** Add visual transitions (e.g., fades) when the map or filter changes in the player view.

---