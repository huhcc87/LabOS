#!/usr/bin/env python3
"""
LabOS Migration CLI

Usage:
  python migrate.py status              — show current migration state
  python migrate.py upgrade [target]    — apply migrations (default: head)
  python migrate.py downgrade [target]  — roll back (default: -1)
  python migrate.py stamp <revision>    — mark DB at revision without SQL
  python migrate.py create <message>    — create new migration file
  python migrate.py create <message> --autogenerate  — autogenerate from model diff
  python migrate.py history             — list all revisions
"""

import sys
import os

# Ensure backend package is importable from this script's directory
sys.path.insert(0, os.path.dirname(__file__))

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

from app.core import migrations as mig


def _color(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m"


def green(t): return _color(t, "32")
def red(t):   return _color(t, "31")
def yellow(t): return _color(t, "33")
def cyan(t):  return _color(t, "36")
def bold(t):  return _color(t, "1")


def cmd_status():
    status = mig.get_status()
    print(bold("\n=== LabOS Migration Status ==="))
    print(f"  Current revision : {cyan(status['current_revision'] or 'None (untracked)')}")
    print(f"  Head revision    : {cyan(status['head_revision'] or 'None')}")
    if status["is_up_to_date"]:
        print(f"  State            : {green('✅ Up to date')}")
    elif status["is_untracked"]:
        print(f"  State            : {yellow('⚠️  Untracked (no alembic_version table)')}")
    else:
        print(f"  State            : {yellow(f'⏳ {status[\"pending_count\"]} pending migration(s)')}")
        for rev in status["pending_revisions"]:
            print(f"    → {rev}")
    print(f"  Checked at       : {status['checked_at']}\n")


def cmd_history():
    history = mig.get_history()
    print(bold("\n=== Migration History ==="))
    for entry in history:
        if entry["is_current"]:
            marker = green("→ (current)")
        elif entry["is_applied"]:
            marker = green("✓")
        else:
            marker = yellow("○ (pending)")
        desc = entry["description"] or ""
        print(f"  {marker:30s}  {entry['revision']}  {desc}")
    print()


def cmd_upgrade(target="head"):
    print(f"Applying migrations to {bold(target)} ...")
    result = mig.upgrade(target)
    if result["success"]:
        print(green(f"✅ Done: {result['from_revision']} → {result['to_revision']}"))
    else:
        print(red(f"❌ Failed: {result['error']}"))
        sys.exit(1)


def cmd_downgrade(target="-1"):
    print(f"Rolling back to {bold(target)} ...")
    result = mig.downgrade(target)
    if result["success"]:
        print(green(f"✅ Done: {result['from_revision']} → {result['to_revision']}"))
    else:
        print(red(f"❌ Failed: {result['error']}"))
        sys.exit(1)


def cmd_stamp(revision):
    print(f"Stamping DB at {bold(revision)} ...")
    result = mig.stamp(revision)
    if result["success"]:
        print(green(f"✅ Stamped at {result['stamped_revision']}"))
    else:
        print(red(f"❌ Failed: {result['error']}"))
        sys.exit(1)


def cmd_create(message, autogenerate=False):
    mode = "autogenerate" if autogenerate else "empty"
    print(f"Creating {mode} migration: {bold(message)} ...")
    result = mig.create_revision(message, autogenerate)
    if result["success"]:
        print(green(f"✅ Created revision {result['revision']}"))
    else:
        print(red(f"❌ Failed: {result['error']}"))
        sys.exit(1)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    cmd = args[0].lower()

    if cmd == "status":
        cmd_status()
    elif cmd == "history":
        cmd_history()
    elif cmd == "upgrade":
        target = args[1] if len(args) > 1 else "head"
        cmd_upgrade(target)
    elif cmd == "downgrade":
        target = args[1] if len(args) > 1 else "-1"
        cmd_downgrade(target)
    elif cmd == "stamp":
        if len(args) < 2:
            print(red("Error: stamp requires a revision argument"))
            sys.exit(1)
        cmd_stamp(args[1])
    elif cmd == "create":
        if len(args) < 2:
            print(red("Error: create requires a message argument"))
            sys.exit(1)
        autogenerate = "--autogenerate" in args
        cmd_create(args[1], autogenerate)
    else:
        print(red(f"Unknown command: {cmd}"))
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
