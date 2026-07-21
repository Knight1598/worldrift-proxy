#!/usr/bin/env python3
"""
Produces a self-contained build of Blacksmith Tycoon for publishing as a
Claude Artifact -- NOT used for the repo-served games/blacksmith-tycoon.html.

Why this exists: games/blacksmith-tycoon.html references sprite/icon images
via relative paths like "assets/blacksmith/coin.png", which resolve fine when
the file is served from within the repo (games/assets/ sits right next to
it). An Artifact is a single hosted file with no access to any sibling
folder, so every one of those images 404s and shows as a broken-image icon --
confirmed via a user screen recording where the worker sprite, coin icon, and
product icons all rendered as blank "?" placeholders.

This script starts from the already-built games/blacksmith-tycoon.html (run
build.py first) and inlines every referenced games/assets/blacksmith/*.png as
a base64 data: URI, so the result has zero external dependencies and is safe
to publish as an Artifact. Run this again (after build.py) any time the game
changes and the Artifact needs updating -- do not publish
games/blacksmith-tycoon.html to the Artifact tool directly, or the images
will break again.
"""
import re
import base64
import pathlib

GAMES_DIR = pathlib.Path(__file__).resolve().parent.parent
SRC_FILE = GAMES_DIR / 'blacksmith-tycoon.html'
ASSET_DIR = GAMES_DIR / 'assets' / 'blacksmith'
OUT_FILE = GAMES_DIR / 'blacksmith-tycoon-src' / 'blacksmith-tycoon.artifact.html'


def main():
    html = SRC_FILE.read_text(encoding='utf-8')
    refs = sorted(set(re.findall(r'assets/blacksmith/([a-zA-Z0-9_]+\.png)', html)))
    for fname in refs:
        data = (ASSET_DIR / fname).read_bytes()
        b64 = base64.b64encode(data).decode('ascii')
        html = html.replace(f'assets/blacksmith/{fname}', f'data:image/png;base64,{b64}')
    OUT_FILE.write_text(html, encoding='utf-8')
    print(f'Inlined {len(refs)} assets -> {OUT_FILE} ({len(html)} bytes)')
    print('Publish this file (not games/blacksmith-tycoon.html) via the Artifact tool.')


if __name__ == '__main__':
    main()
