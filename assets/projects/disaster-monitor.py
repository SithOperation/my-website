import json
import os
import time
import requests
from pathlib import Path
from datetime import datetime, timezone

STATE_FILE = Path("disaster_state.json")
DISCORD_WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]

EARTHQUAKE_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
VOLCANO_FEED = "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes"

MIN_GLOBAL_MAG = 5.5
MIN_US_MAG = 4.5
DISCORD_LIMIT = 1900

def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {
        "seen_earthquakes": [],
        "seen_volcanoes": []
    }

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))

def send_discord_alert(message):
    response = requests.post(
        DISCORD_WEBHOOK_URL,
        json={"content": message[:DISCORD_LIMIT]},
        timeout=20
    )

    if response.status_code == 429:
        retry_after = response.json().get("retry_after", 5)
        time.sleep(retry_after + 1)

        response = requests.post(
            DISCORD_WEBHOOK_URL,
            json={"content": message[:DISCORD_LIMIT]},
            timeout=20
        )

    response.raise_for_status()
    time.sleep(2)

def fetch_json(url):
    response = requests.get(
        url,
        headers={"User-Agent": "DisasterDiscordMonitor/1.0"},
        timeout=20
    )

    response.raise_for_status()
    return response.json()

def check_earthquakes(state):
    data = fetch_json(EARTHQUAKE_FEED)

    seen = set(state["seen_earthquakes"])

    for quake in data.get("features", []):

        props = quake.get("properties", {})

        quake_id = quake.get("id")
        mag = props.get("mag")
        place = props.get("place", "Unknown location")
        tsunami = props.get("tsunami", 0)
        url = props.get("url", "")

        if quake_id in seen or mag is None:
            continue

        is_us = any(term in place for term in [
            "CA", "AK", "HI", "NV", "WA",
            "OR", "UT", "ID", "WY", "MT",
            "US"
        ])

        should_alert = (
            mag >= MIN_GLOBAL_MAG
            or (is_us and mag >= MIN_US_MAG)
            or tsunami == 1
        )

        if should_alert:
            send_discord_alert(
                f"🌎 **Earthquake Alert**\n\n"
                f"Magnitude: **{round(mag, 1)}**\n"
                f"Location: {place}\n"
                f"Tsunami flag: {tsunami}\n"
                f"{url}"
            )

        seen.add(quake_id)

    state["seen_earthquakes"] = list(seen)

def check_volcanoes(state):
    data = fetch_json(VOLCANO_FEED)

    seen = set(state["seen_volcanoes"])

    volcanoes = []

    if isinstance(data, list):
        volcanoes = data
    elif isinstance(data, dict):
        volcanoes = (
            data.get("volcanoes")
            or data.get("features")
            or data.get("items")
            or []
        )

    for volcano in volcanoes:

        props = volcano.get("properties", volcano)

        name = (
            props.get("volcanoName")
            or props.get("volcano")
            or props.get("name")
            or props.get("title")
            or props.get("site")
            or "Unknown volcano"
        )

        volcano_id = str(
            props.get("volcanoId")
            or props.get("id")
            or props.get("vnum")
            or name
        )

        alert_level = (
            props.get("alertLevel")
            or props.get("alertlevel")
            or props.get("alert_level")
            or props.get("status")
            or "Unknown"
        )

        aviation_color = (
            props.get("aviationColorCode")
            or props.get("aviation_color_code")
            or props.get("aviationColor")
            or props.get("colorCode")
            or "Unknown"
        )

        location = (
            props.get("region")
            or props.get("location")
            or props.get("observatory")
            or props.get("country")
            or "Unknown region"
        )

        volcano_url_name = str(name).lower().replace(" ", "-")

        url = (
            props.get("url")
            or props.get("link")
            or f"https://volcanoes.usgs.gov/volcanoes/{volcano_url_name}/"
        )

        unique_key = f"{volcano_id}-{alert_level}-{aviation_color}"

        if unique_key in seen:
            continue

        send_discord_alert(
            f"🌋 **Volcano Alert**\n\n"
            f"Volcano: **{name}**\n"
            f"Region: {location}\n"
            f"Alert level: **{alert_level}**\n"
            f"Aviation color: **{aviation_color}**\n"
            f"{url}"
        )

        seen.add(unique_key)

    state["seen_volcanoes"] = list(seen)

def main():
    state = load_state()

    try:
        check_earthquakes(state)
    except Exception as e:
        try:
            send_discord_alert(
                f"⚠️ Earthquake monitor error:\n`{e}`"
            )
        except Exception:
            pass

    try:
        check_volcanoes(state)
    except Exception as e:
        try:
            send_discord_alert(
                f"⚠️ Volcano monitor error:\n`{e}`"
            )
        except Exception:
            pass

    state["last_checked"] = datetime.now(timezone.utc).isoformat()

    save_state(state)

if __name__ == "__main__":
    main()
