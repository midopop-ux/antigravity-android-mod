#!/usr/bin/env python3
"""
web/patch_bidi_user_bubble.py - Fix Arabic/English text scrambling in user message bubbles.

Ensures that user prompt messages rendered via bwb have line-by-line bidirectional
alignment and isolation:
- Every line containing any Arabic character gets dir="rtl", direction="rtl", textAlign="right".
- Pure English/code/link lines get dir="ltr", direction="ltr", textAlign="left".
- Reading order of mixed Arabic/English sentences is naturally preserved.
"""

from pathlib import Path
import sys

MARKER = "/* AGY_BIDI_USER_BUBBLE_V24 */"

def one(s, old, new):
    count = s.count(old)
    if count != 1:
        raise ValueError(f"expected 1 anchor, found {count}: {old[:120]}")
    return s.replace(old, new, 1)

def patch(s):
    if MARKER in s:
        print("[bidi-user-patch] already patched, skipping")
        return s

    anchor = 'bwb=({items:a})=>{var {chatParams:{artifactsDir:b},trajectorySummariesProvider:c,stepHandler:e}=Jy();return A.createElement("div",{"data-quotable":"true",className:"whitespace-pre-wrap text-sm",style:{wordBreak:"break-word"}},a.map((f,g)=>{f=f.chunk;if(f.case==="text")return f.value;var h=f.value;return A.createElement("span",{key:g,className:"context-scope-mention","data-quotable-inline":"true"},A.createElement(pC,{item:h,artifactsDir:b,openUri:(k,l)=>{e?.openFile(k,void 0,void 0,!1,{event:l,\nisDirectory:h?.scopeItem?.case==="directory"})},getFileIcon:e?.getFileIcon,trajectorySummariesProvider:c,openWorkflow:e?.openWorkflow,openConversation:e?.openConversation}))}))};'

    replacement = MARKER + 'bwb=({items:a})=>{var {chatParams:{artifactsDir:b},trajectorySummariesProvider:c,stepHandler:e}=Jy();var lines=[[]],AR=/[\\u0600-\\u06FF\\u0750-\\u077F\\u0870-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;(a||[]).forEach((f,g)=>{var ck=f?.chunk;if(!ck)return;if(ck.case==="text"){var parts=String(ck.value||"").split("\\n");for(var i=0;i<parts.length;i++){if(i>0)lines.push([]);if(parts[i].length>0)lines[lines.length-1].push(parts[i]);}}else{var h=ck.value;lines[lines.length-1].push(A.createElement("span",{key:"m_"+g,className:"context-scope-mention","data-quotable-inline":"true"},A.createElement(pC,{item:h,artifactsDir:b,openUri:(k,l)=>{e?.openFile(k,void 0,void 0,!1,{event:l,isDirectory:h?.scopeItem?.case==="directory"})},getFileIcon:e?.getFileIcon,trajectorySummariesProvider:c,openWorkflow:e?.openWorkflow,openConversation:e?.openConversation})));}});\nreturn A.createElement("div",{"data-quotable":"true",className:"whitespace-pre-wrap text-sm",style:{wordBreak:"break-word"}},lines.map((ln,idx)=>{var txt=ln.map(x=>typeof x==="string"?x:"").join("");var hasAr=AR.test(txt);return A.createElement("div",{key:idx,dir:hasAr?"rtl":"ltr",style:{direction:hasAr?"rtl":"ltr",textAlign:hasAr?"right":"left",unicodeBidi:"isolate",minHeight:ln.length===0?"1.25em":void 0}},ln.length===0?"\\u00A0":ln);}));};'

    s = one(s, anchor, replacement)
    return s

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: patch_bidi_user_bubble.py INPUT OUTPUT")
    src, dst = map(Path, sys.argv[1:])
    source = src.read_text(encoding="utf8")
    patched = patch(source)
    dst.write_text(patched, encoding="utf8")
    print("[bidi-user-patch] User message bubble bidi fix applied successfully", len(patched))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError) as err:
        raise SystemExit("[bidi-user-patch] incompatible: " + str(err))
