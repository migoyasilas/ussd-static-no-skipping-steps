# USSD requirements implemented in the original source

This version keeps the existing `steps[]` array behavior. It does **not** implement server-driven dynamic steps.

Implemented:

1. **Do not enter steps before a real USSD dialog/menu is detected.**
   - Existing grace period remains.
   - Added a conservative USSD-dialog gate so ordinary phone/in-call UI is ignored.
   - The app waits for menu/dialog controls, an input field, or a recognizable menu/prompt before processing a step.

2. **Do not skip steps.**
   - A step is advanced only after its text is successfully entered AND the Send action is successfully clicked.
   - If input cannot be entered, the current step is not advanced; the session is aborted and the dialog is closed.
   - If Send cannot be clicked, the current step is not advanced; the session is aborted and the dialog is closed.

3. **Close the USSD dialog when a process ends.**
   - Normal completion uses the existing dismiss controls first.
   - If no dismiss control can be found, Android `BACK` is used as a fallback.
   - Carrier-error termination also closes the dialog.

4. **Clear/close a previous USSD session before a new request.**
   - Before a new request starts, an active stale USSD dialog is dismissed.
   - Session state, duplicate-event state, and cooldown state are reset.
   - A short 500 ms cleanup delay is used before starting the next USSD request.

5. **Dynamic/server-driven steps are intentionally NOT implemented here.**
   - The original `steps[]` array remains the source of step order.

## Build

The project already contains `.github/workflows/android.yml`, which can build `app-debug.apk` on GitHub Actions.

These changes are Android source changes, so the APK must be rebuilt for them to be present in an installed APK. Server-only changes would not require an APK rebuild.
