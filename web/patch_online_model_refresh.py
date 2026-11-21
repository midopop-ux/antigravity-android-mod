#!/usr/bin/env python3
"""
web/patch_online_model_refresh.py - Instant model refresh on network reconnect.

Adds an 'online' event listener to PollingUserStatusProvider (Pzc) so that
when internet connectivity returns, it immediately fetches the updated models
and user status from the language server, while keeping its normal 10-minute
polling interval completely intact.
"""

from pathlib import Path
import sys

MARKER = "/* AGY_ONLINE_MODEL_REFRESH_V24 */"

def one(s, old, new):
    count = s.count(old)
    if count != 1:
        raise ValueError(f"expected 1 anchor, found {count}: {old[:120]}")
    return s.replace(old, new, 1)

def patch(s):
    if MARKER in s:
        print("[online-model-refresh] already patched, skipping")
        return s

    anchor = "this.intervalId=setInterval(()=>{Ozc(this)},6E5);if(this.authStateProvider)this.authStateProvider.onDidChange(()=>void Ozc(this))"
    replacement = (
        'this.intervalId=setInterval(()=>{Ozc(this)},6E5);'
        'if(typeof window!=="undefined"){window.addEventListener("online",()=>{try{Ozc(this)}catch(_){}})};'
        'if(this.authStateProvider)this.authStateProvider.onDidChange(()=>void Ozc(this))'
        + MARKER
    )

    s = one(s, anchor, replacement)
    return s

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: patch_online_model_refresh.py INPUT OUTPUT")
    src, dst = map(Path, sys.argv[1:])
    source = src.read_text(encoding="utf8")
    patched = patch(source)
    dst.write_text(patched, encoding="utf8")
    print("[online-model-refresh] Online model refresh listener applied successfully", len(patched))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError) as err:
        raise SystemExit("[online-model-refresh] incompatible: " + str(err))
