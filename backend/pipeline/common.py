"""
Shared helpers for the TracingInsights data pipeline.

Data sources (all kept in data/sources/, which is git-ignored and never published):
  - Stats     https://github.com/TracingInsights-Archive/Stats      (MIT)        git clone --depth 1
  - PitStops  https://github.com/TracingInsights-Archive/PitStops   (MIT)        git clone --depth 1
  - 2026      https://github.com/TracingInsights/2026               (Apache-2.0) race files only, see fetch_race_file()
  - 2025      https://github.com/TracingInsights/2025               (Apache-2.0) race files only

The two telemetry repos are 4 GB and 15 GB, so instead of cloning them we download only
the Race-session files the site uses (lap times, weather, corners, drivers, and a handful
of per-lap telemetry files) and cache them under data/sources/telemetry/.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "data" / "sources"
STATS = SOURCES / "Stats"
PITSTOPS = SOURCES / "PitStops"
TELEMETRY_CACHE = SOURCES / "telemetry"
WEB = ROOT / "web"
WEB_DATA = WEB / "data"  # small JSON imported by server components
PUBLIC_DATA = WEB / "public" / "data"  # per-circuit + model files fetched by the browser
MODELS_DIR = ROOT / "models"

SEASON = 2026
TELEMETRY_REPOS = {2026: "TracingInsights/2026", 2025: "TracingInsights/2025"}
GIT_REPOS = {
    "Stats": "https://github.com/TracingInsights-Archive/Stats.git",
    "PitStops": "https://github.com/TracingInsights-Archive/PitStops.git",
}
# Stats lap times are large; models only use 2018 onwards, so older ones are left out of the checkout.
STATS_SPARSE = ["/*", "!/19*/*/laptimes.json", "!/200*/*/laptimes.json", "!/201[0-7]/*/laptimes.json"]

# ---------------------------------------------------------------------------
# Teams: every historic name maps to its 2026 team
# ---------------------------------------------------------------------------
TEAMS_2026 = [
    "McLaren", "Mercedes", "Red Bull", "Ferrari", "Williams", "Racing Bulls",
    "Aston Martin", "Haas", "Audi", "Alpine", "Cadillac",
]
_TEAM_ALIASES = {
    "mclaren": "McLaren",
    "mercedes": "Mercedes",
    "red bull": "Red Bull", "red bull racing": "Red Bull", "red_bull": "Red Bull",
    "ferrari": "Ferrari",
    "williams": "Williams",
    "racing bulls": "Racing Bulls", "rb": "Racing Bulls", "rb f1 team": "Racing Bulls", "visa cash app rb": "Racing Bulls",
    "alphatauri": "Racing Bulls", "toro rosso": "Racing Bulls", "toro_rosso": "Racing Bulls",
    "aston martin": "Aston Martin", "aston_martin": "Aston Martin", "racing point": "Aston Martin",
    "racing_point": "Aston Martin", "force india": "Aston Martin", "force_india": "Aston Martin",
    "haas": "Haas", "haas f1 team": "Haas",
    "audi": "Audi", "sauber": "Audi", "kick sauber": "Audi", "alfa romeo": "Audi", "alfa": "Audi",
    "alpine": "Alpine", "alpine f1 team": "Alpine", "renault": "Alpine",
    "cadillac": "Cadillac", "cadillac f1 team": "Cadillac",
}


def team_2026(name: str | None) -> str | None:
    """Map any team name or Ergast constructorId (2018–2026) to its 2026 team name."""
    if not name:
        return None
    return _TEAM_ALIASES.get(str(name).strip().lower(), str(name).strip())


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------
def log(msg: str) -> None:
    print(msg, flush=True)


def read_json(path: Path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path: Path, data, compact: bool = True) -> int:
    """Write JSON (compact by default) and return its size in bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # allow_nan=False: browsers can't parse NaN/Infinity, so fail here instead of on the website
    text = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":") if compact else None, indent=None if compact else 2)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def slugify(text: str) -> str:
    """'São Paulo Grand Prix' -> 'sao-paulo' (matches the calendar's slugs)."""
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    s = s.lower().replace("grand prix", "").strip()
    return "-".join(part for part in "".join(c if c.isalnum() else " " for c in s).split())


def num(value, default=None):
    """Parse numbers that may arrive as 'None', '', None or strings."""
    if value is None or value == "None" or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def lap_str_to_seconds(text: str | None) -> float | None:
    """'1:32.871' -> 92.871"""
    if not text:
        return None
    try:
        if ":" in text:
            m, s = text.split(":", 1)
            return int(m) * 60 + float(s)
        return float(text)
    except ValueError:
        return None


def seconds_to_lap_str(sec: float | None) -> str | None:
    if sec is None:
        return None
    m = int(sec // 60)
    return f"{m}:{sec - m * 60:06.3f}"


# ---------------------------------------------------------------------------
# Repos
# ---------------------------------------------------------------------------
def sync_git_repos() -> dict[str, str]:
    """Clone (depth 1) or pull Stats and PitStops. Returns the HEAD commit of each."""
    SOURCES.mkdir(parents=True, exist_ok=True)
    heads = {}
    for name, url in GIT_REPOS.items():
        path = SOURCES / name
        if not (path / ".git").exists():
            log(f"Cloning {name} (depth 1)...")
            subprocess.run(["git", "clone", "-q", "--depth", "1", "--no-checkout", url, str(path)], check=True)
            if name == "Stats":
                subprocess.run(["git", "-C", str(path), "sparse-checkout", "init", "--no-cone"], check=True, capture_output=True)
                (path / ".git" / "info" / "sparse-checkout").write_text("\n".join(STATS_SPARSE) + "\n")
            subprocess.run(["git", "-C", str(path), "checkout", "-q"], check=True)
        else:
            log(f"Pulling {name}...")
            subprocess.run(["git", "-C", str(path), "pull", "-q", "--depth", "1", "--rebase=false", "--allow-unrelated-histories"],
                           check=False, capture_output=True)
        out = subprocess.run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
        heads[name] = out.stdout.strip()
    return heads


def _github_get(url: str, retries: int = 3) -> bytes | None:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "f1-fan-hub-pipeline"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2 * (attempt + 1))
    return None


def fetch_race_file(season: int, grand_prix: str, rel: str, refresh: bool = False):
    """
    Download one file from <season repo>/<grand_prix>/Race/<rel> (cached under data/sources/telemetry).
    Returns parsed JSON, or None if the file doesn't exist in the repo.
    `refresh=True` re-downloads small session files so new races are picked up.
    """
    cache = TELEMETRY_CACHE / str(season) / grand_prix / "Race" / rel
    missing_marker = cache.with_suffix(cache.suffix + ".missing")
    if cache.exists() and not refresh:
        return read_json(cache)
    if missing_marker.exists() and not refresh:
        return None
    repo = TELEMETRY_REPOS[season]
    url = f"https://raw.githubusercontent.com/{repo}/main/" + urllib.parse.quote(f"{grand_prix}/Race/{rel}")
    body = _github_get(url)
    cache.parent.mkdir(parents=True, exist_ok=True)
    if body is None:
        missing_marker.write_text("")
        return None
    if missing_marker.exists():
        missing_marker.unlink()
    cache.write_bytes(body)
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def list_repo_grands_prix(season: int) -> list[str]:
    """Grand Prix folders in a telemetry repo (one small API call, cached for the run)."""
    cache = TELEMETRY_CACHE / str(season) / "_folders.json"
    data = _github_get(f"https://api.github.com/repos/{TELEMETRY_REPOS[season]}/contents/")
    if data:
        names = [x["name"] for x in json.loads(data) if x.get("type") == "dir" and x["name"].endswith("Grand Prix")]
        write_json(cache, names)
        return names
    return read_json(cache, [])
