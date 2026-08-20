#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
INDEX = ROOT / "index.html"
BACKUP = ROOT / "index.html.before-meta.bak"

if not INDEX.exists():
    print("ERROR: index.html was not found in the current directory.")
    sys.exit(1)

html = INDEX.read_text(encoding="utf-8")

if "</head>" not in html.lower():
    print("ERROR: </head> was not found in index.html.")
    sys.exit(1)

# Remove a previous ATHR metadata block if this installer is re-run.
html = re.sub(
    r"\s*<!-- ATHR_META_V1_START -->.*?<!-- ATHR_META_V1_END -->\s*",
    "",
    html,
    flags=re.S,
)

# Avoid duplicate social tags if older attempts added any of them.
patterns = [
    r'<meta\s+property=["\']og:[^>]*>',
    r'<meta\s+name=["\']twitter:[^>]*>',
    r'<meta\s+name=["\']robots["\'][^>]*>',
    r'<meta\s+name=["\']theme-color["\'][^>]*>',
]
for pattern in patterns:
    html = re.sub(pattern, "", html, flags=re.I)

meta = '''
<!-- ATHR_META_V1_START -->
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0D4F34">

<meta property="og:type" content="website">
<meta property="og:locale" content="ar_AR">
<meta property="og:site_name" content="أثر">
<meta property="og:title" content="أثر | معرفة تترك أثرًا">
<meta property="og:description" content="منتجات رقمية هادفة تساعدك على بناء حياة أكثر وعيًا واتزانًا، لك ولمن تحب.">
<meta property="og:image" content="/assets/athr-og-v1.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="أثر — معرفة تترك أثرًا">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="أثر | معرفة تترك أثرًا">
<meta name="twitter:description" content="منتجات رقمية هادفة تساعدك على بناء حياة أكثر وعيًا واتزانًا، لك ولمن تحب.">
<meta name="twitter:image" content="/assets/athr-og-v1.jpg">
<meta name="twitter:image:alt" content="أثر — معرفة تترك أثرًا">
<!-- ATHR_META_V1_END -->
'''.strip()

# Insert immediately before </head>, preserving the rest of the file exactly.
head_close = re.search(r"</head>", html, flags=re.I)
new_html = html[:head_close.start()] + meta + html[head_close.start():]

if not BACKUP.exists():
    shutil.copy2(INDEX, BACKUP)

INDEX.write_text(new_html, encoding="utf-8")
print("ATHR metadata installed successfully.")
print("OG image: assets/athr-og-v1.jpg")
print("Backup: index.html.before-meta.bak")
print("Note: add canonical/og:url with the final production domain later.")
