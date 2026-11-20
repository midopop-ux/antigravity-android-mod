#!/usr/bin/env python3
"""
web/patch_auto_retry.py - Silent automatic retry on transient stream drops during peak hours.

When third-party or congested models (e.g. GPT module, OpenAI gateways, or busy proxies)
experience 5-second idle timeouts, deadline exceeded (code 4), or stream drops (code 14):
1. Completely suppresses the error card / "Try again" window from the UI (AVb returns null).
2. Suppresses false completion / disconnect notifications in Android status bar (__AGY_RETRYING_CONVS__).
3. Automatically triggers stream resume (type: 7) in the background with exponential backoff (up to 8 attempts).
4. Only fires the genuine completion notification once the model finishes generating the real final result.
"""

from pathlib import Path
import sys

MARKER = "/* AGY_AUTO_RETRY_PEAK_V25 */"

def one(s, old, new):
    count = s.count(old)
    if count != 1:
        raise ValueError(f"expected 1 anchor, found {count}: {old[:120]}")
    return s.replace(old, new, 1)

def patch(s):
    if MARKER in s:
        print("[auto-retry-patch] already patched, skipping")
        return s

    # 1. AVb hook: inject silent background retry and suppress the error card
    old_avb = 'A.useEffect(()=>{u?.kind==="tosViolation"&&b?.checkCurrentAuthStatus?.()},[u?.kind,b]);'
    new_avb = (
        old_avb +
        'A.useEffect(()=>{'
        'if(u?.kind==="retryable"&&f&&e){'
        'let key=`${f}-${h}`;'
        'let map=(window.__AGY_AUTO_RETRY_MAP__||(window.__AGY_AUTO_RETRY_MAP__=new Map()));'
        'let att=map.get(key)||0;'
        'if(att<8){'
        'let delay=att===0?1000:(att===1?2000:(att===2?3500:5000));'
        '(window.__AGY_RETRYING_CONVS__||(window.__AGY_RETRYING_CONVS__=new Set())).add(f);'
        'try{'
        'if(window.Android?.onAgentState&&window.__AG_NATIVE_BRIDGE_TOKEN__){'
        'window.Android.onAgentState(window.__AG_NATIVE_BRIDGE_TOKEN__,f,2,false,"Reconnecting (Peak Hour Resilience)...");'
        '}'
        '}catch(_){}'
        'let timer=setTimeout(()=>{'
        'map.set(key,att+1);'
        'try{'
        'console.log(`[AGY Peak Auto-Retry] Silently resuming cascade ${f} (attempt ${att+1}/8)...`);'
        'e({type:7,cascadeId:f});'
        '}catch(_){}'
        '},delay);'
        'return()=>clearTimeout(timer);'
        '}else{'
        'window.__AGY_RETRYING_CONVS__?.delete(f);'
        '}'
        '}'
        '},[u?.kind,f,h,e]);'
        'A.useEffect(()=>{'
        'return()=>{'
        'setTimeout(()=>{'
        'if(!tVb()?.errorDetails&&f){'
        'window.__AGY_RETRYING_CONVS__?.delete(f);'
        '}'
        '},500);'
        '};'
        '},[f]);'
        'if(u?.kind==="retryable"){'
        'let _rk=`${f}-${h}`;'
        'let _at=window.__AGY_AUTO_RETRY_MAP__?.get(_rk)||0;'
        'if(_at<8)return null;'
        '}'
    )
    s = one(s, old_avb, new_avb)

    # 2. zVb switch case: fallback card if all 8 attempts are exhausted
    old_zvb = (
        'case "retryable":return{id:c,icon:e,title:"Agent terminated due to error",\n'
        'message:a.customMessage??"This error is likely temporary. You can prompt the model to try again after some time.",primaryAction:v("Try again"),secondaryAction:b()};'
    )
    new_zvb = (
        'case "retryable":'
        'let _rk=`${u}-${g?.stepIndex}`;'
        'let _at=window.__AGY_AUTO_RETRY_MAP__?.get(_rk)||0;'
        'let _ttl=_at<8?"Reconnecting (Peak Hour Resilience)...":"Agent terminated due to error";'
        'let _msg=_at<8?`Server connection interrupted during peak traffic. Resuming automatically (attempt ${_at+1}/8)...`:(a.customMessage??"This error is likely temporary. You can prompt the model to try again after some time.");'
        'let _btn=_at<8?"Resuming...":"Try again";'
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
    print("[auto-retry-patch] Silent auto-retry patch applied successfully", len(patched))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError) as err:
        raise SystemExit("[auto-retry-patch] incompatible: " + str(err))
