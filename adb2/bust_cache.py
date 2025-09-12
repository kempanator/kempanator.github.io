#!/usr/bin/env python3
import re
import sys
import secrets
import argparse
from pathlib import Path

def is_external(url: str) -> bool:
  u = url.strip()
  return u.startswith("http://") or u.startswith("https://") or u.startswith("//")

def bust(url: str, version: str) -> str:
  base = url.split("?", 1)[0]
  if is_external(base):
    return url
  return f"{base}?v={version}"

def process_html(text: str, version: str) -> str:
  def repl_link(m):
    return f'{m.group(1)}{bust(m.group(2), version)}{m.group(3)}'
  def repl_script(m):
    return f'{m.group(1)}{bust(m.group(2), version)}{m.group(3)}'
  text = re.sub(r'(<link[^>]+href=")([^"]+)(")', repl_link, text)
  text = re.sub(r'(<script[^>]+src=")([^"]+)(")', repl_script, text)
  return text

def main():
  ap = argparse.ArgumentParser(description="Append cache-busting ?v=HASH to local CSS/JS in HTML.")
  ap.add_argument("-f", "--file", default="index.html", help="HTML file to update (default: index.html)")
  ap.add_argument("-v", "--version", help="Version/hash to use (default: random 8-hex)")
  ap.add_argument("--dry-run", action="store_true", help="Print output to stdout instead of writing file")
  args = ap.parse_args()

  path = Path(args.file)
  if not path.exists():
    print(f"File not found: {path}", file=sys.stderr)
    sys.exit(1)

  version = args.version or secrets.token_hex(4)  # 8 hex chars
  html = path.read_text(encoding="utf-8")
  out = process_html(html, version)

  if args.dry_run:
    sys.stdout.write(out)
  else:
    path.write_text(out, encoding="utf-8")
    print(f"Cache bust complete for {path} with version: {version}")

if __name__ == "__main__":
  main()
