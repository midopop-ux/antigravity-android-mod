#!/usr/bin/env python3
"""
web/patch_auto_retry.py - Automatic retry on transient stream drops during peak hours.

When third-party or congested models (e.g. GPT module, OpenAI gateways, or busy proxies)
experience 5-second idle timeouts, deadline exceeded (code 4), or stream drops (code 14):
1. Intercepts the retryable error card in the chat UI.
2. Automatically triggers retry (type: 7) with exponential backoff (up to 3 attempts).
3. Updates the UI to show an informative reconnecting status instead of a dead error.
4. Preserves manual retry button if all 3 attempts are exhausted.
"""

from pathlib import Path
import sys

MARKER = "/* AGY_AUTO_RETRY_PEAK_V24 */"

def one(s, old, new):
    count = s.count(old)
    if count != 1:
        raise ValueError(f"expected 1 anchor, found {count}: {old[:120]}")
    return s.replace(old, new, 1)

def patch(s):
    if MARKER in s:
        print("[auto-retry-patch] already patched, skipping")
        return s

    # 1. AVb hook: inject useEffect for automatic retry
    old_avb = 'A.useEffect(()=>{u?.kind==="tosViolation"&&b?.checkCurrentAuthStatus?.()},[u?.kind,b]);'
    new_avb = (
        old_avb +
        'A.useEffect(()=>{'
        'if(u?.kind==="retryable"&&f&&e){'
        'let key=`${f}-${h}`;'
        'let map=(window.__AGY_AUTO_RETRY_MAP__||(window.__AGY_AUTO_RETRY_MAP__=new Map()));'
        'let att=map.get(key)||0;'
        'if(att<3){'
        'let delay=att===0?1200:(att===1?2500:4000);'
        'let timer=setTimeout(()=>{'
        'map.set(key,att+1);'
        'try{'
        'console.log(`[AGY Peak Auto-Retry] Resuming cascade ${f} (attempt ${att+1}/3)...`);'
        'e({type:7,cascadeId:f});'
        '}catch(_){}'
        '},delay);'
        'return()=>clearTimeout(timer);'
        '}'
        '}'
        '},[u?.kind,f,h,e]);'
    )
    s = one(s, old_avb, new_avb)

    # 2. zVb switch case: update retryable UI to show reconnection status and countdown
    old_zvb = (
        'case "retryable":return{id:c,icon:e,title:"Agent terminated due to error",\n'
        'message:a.customMessage??"This error is likely temporary. You can prompt the model to try again after some time.",primaryAction:v("Try again"),secondaryAction:b()};'
    )
    new_zvb = (
        'case "retryable":'
        'let _rk=`${u}-${g?.stepIndex}`;'
        'let _at=window.__AGY_AUTO_RETRY_MAP__?.get(_rk)||0;'
        'let _ttl=_at<3?"Reconnecting (Peak Hour Resilience)...":"Agent terminated due to error";'
        'let _msg=_at<3?`Server connection interrupted during peak traffic. Resuming automatically (attempt ${_at+1}/3)...`:(a.customMessage??"This error is likely temporary. You can prompt the model to try again after some time.");'
        'let _btn=_at<3?"Resuming...":"Try again";'
        'return{id:c,icon:e,title:_ttl,message:_msg,primaryAction:v(_btn),secondaryAction:b()};'
        + MARKER
    )
    s = one(s, old_zvb, new_zvb)

    return s

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: patch_auto_retry.py INPUT OUTPUT")
    src, dst = map(Path, sys.argv[1:])
    source = src.read_text(encoding="utf8")
    patched = patch(source)
    dst.write_text(patched, encoding="utf8")
    print("[auto-retry-patch] Peak hour auto-retry patch applied successfully", len(patched))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError) as err:
        raise SystemExit("[auto-retry-patch] incompatible: " + str(err))
