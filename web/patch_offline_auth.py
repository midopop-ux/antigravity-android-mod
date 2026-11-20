#!/usr/bin/env python3
"""
web/patch_offline_auth.py - Offline cache & auth bypass for Antigravity WebView.

Ensures that when the user opens the application while offline (no internet /
airplane mode / network unreachable):
1. The app preserves authenticated state from local cache rather than kicking the
   user out to /onboarding (Image 1).
2. The router lands cleanly on '/' (Image 2) showing all offline cached chats
   and workspaces.
3. Automatically re-validates online auth once network connectivity returns.
"""

from pathlib import Path
import sys

MARKER = "/* AGY_OFFLINE_AUTH_CACHE_V24 */"

def one(s, old, new):
    count = s.count(old)
    if count != 1:
        raise ValueError(f"expected 1 anchor, found {count}: {old[:120]}")
    return s.replace(old, new, 1)

def patch(s):
    if MARKER in s:
        print("[offline-patch] already patched, skipping")
        return s

    # 1. Manager layout: suppress redirect to /onboarding when offline
    old_mgr = 'q=r&&n&&m==="signedOut";m=r&&n&&(m==="signedOut"||m==="loginError"||m==="projectPicker"||m==="licensePicker");'
    new_mgr = old_mgr + 'if(typeof navigator!=="undefined"&&!navigator.onLine){q=!1;m=!1;}'
    s = one(s, old_mgr, new_mgr)

    # 2. Manager landing layout beforeLoad: do not throw redirect to /onboarding when offline
    old_landing = 'c.hasOnboardingScreens&&e!==2&&aQ({to:"/onboarding",search:wR,replace:!0,throw:!0})'
    new_landing = 'c.hasOnboardingScreens&&e!==2&&(typeof navigator==="undefined"||navigator.onLine)&&aQ({to:"/onboarding",search:wR,replace:!0,throw:!0})'
    s = one(s, old_landing, new_landing)

    # 3. /onboarding route beforeLoad: if offline, bounce directly to '/'
    old_onboard = 'path:"/onboarding",component:UJb,beforeLoad:({context:b,search:c})=>{b.hasOnboardingScreens&&b.onboardingState!==2||c.login||aQ({to:c.redirect?.split("?")[0]||"/",search:wR,replace:!0,throw:!0})}'
    new_onboard = 'path:"/onboarding",component:UJb,beforeLoad:({context:b,search:c})=>{if(typeof navigator!=="undefined"&&!navigator.onLine){aQ({to:c.redirect?.split("?")[0]||"/",search:wR,replace:!0,throw:!0})};b.hasOnboardingScreens&&b.onboardingState!==2||c.login||aQ({to:c.redirect?.split("?")[0]||"/",search:wR,replace:!0,throw:!0})}'
    s = one(s, old_onboard, new_onboard)

    # 4. LsAuthService constructor: optimistic cached auth on boot (instant launch online & offline)
    old_auth_init = 'this._authStateProvider=new yi({state:"uninitialized",context:Rg});this._authActor=Tg(Gfa);this._authActor.subscribe(f=>{var g=f.value,\nh=f.context;f.matches("authenticating")?(f=f.children?.authenticatingActor?.getSnapshot(),g=f?.value,this._authStateProvider.setState({state:g==="success"?"signedIn":g==="failure"?"signedOut":g,context:f?.context})):this._authStateProvider.setState({state:g,context:h})});'
    new_auth_init = (
        'let _initAuth="uninitialized";try{if(localStorage.getItem("ag_authenticated")==="1"){_initAuth="signedIn"}}catch(_){}'
        'this._authStateProvider=new yi({state:_initAuth,context:Rg});this._authActor=Tg(Gfa);'
        'if(typeof window!=="undefined"){window.addEventListener("online",()=>{try{if(this&&!this.isLoggingOut)Yy(this,4)}catch(_){}})};'
        'this._authActor.subscribe(f=>{var g=f.value,h=f.context;'
        'var _st=f.matches("authenticating")?(f=f.children?.authenticatingActor?.getSnapshot(),f?.value):(g==="authenticating"?void 0:g);'
        'if(_st==="success")_st="signedIn";else if(_st==="failure")_st="signedOut";'
        'try{if(_st==="signedIn")localStorage.setItem("ag_authenticated","1");else if(_st==="signedOut"&&this.isLoggingOut)localStorage.removeItem("ag_authenticated")}catch(_){};'
        'f.matches("authenticating")?this._authStateProvider.setState({state:g==="success"?"signedIn":g==="failure"?"signedOut":g,context:f?.context}):this._authStateProvider.setState({state:g,context:h})});'
        + MARKER
    )
    s = one(s, old_auth_init, new_auth_init)

    # 5. Yy background auth check: if offline and hasToken, retain signedIn state and skip network check
    old_yy = 'let l=e(await c(a._lsClient.hasAuthToken({})));if(!a.isLoggingOut&&a._currentSessionId===f){var g=a._authStateProvider.getState().state;if(l.hasToken){var h=e(await c(a._lsClient.getAuthStatus({})));'
    new_yy = (
        'let l=e(await c(a._lsClient.hasAuthToken({})));if(!a.isLoggingOut&&a._currentSessionId===f){var g=a._authStateProvider.getState().state;'
        'if(l.hasToken){try{localStorage.setItem("ag_authenticated","1")}catch(_){};'
        'if(typeof navigator!=="undefined"&&!navigator.onLine){if(g!=="signedIn"){a._authActor.send({type:"AUTH_SUCCESS",tokenInfo:{accessToken:""},scopes:[],isGcpTos:!1,project:"",location:"",wifProvider:"",authMode:"offline_cached"})};return;}'
        'var h=e(await c(a._lsClient.getAuthStatus({})));'
    )
    s = one(s, old_yy, new_yy)

    return s

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: patch_offline_auth.py INPUT OUTPUT")
    src, dst = map(Path, sys.argv[1:])
    source = src.read_text(encoding="utf8")
    patched = patch(source)
    dst.write_text(patched, encoding="utf8")
    print("[offline-patch] Offline auth & cached workspace support applied successfully", len(patched))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError) as err:
        raise SystemExit("[offline-patch] incompatible: " + str(err))
