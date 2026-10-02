# Minutes: Meeting Minutes Taker (mobile app)

An app you install on your phone. It listens to a meeting, writes a live transcript, and turns it into meeting minutes: summary, discussion by agenda item, decisions, an action-item table (owner and due date), open questions and next meeting.

It is a **Progressive Web App (PWA)**, so there's no app store. You open it once in the phone's browser and add it to your home screen. It then opens full-screen like any other app and works offline.

## Features

- **Live listening.** The phone's speech recognition transcribes the meeting as people talk. It works in 20+ languages, including English, Urdu, Hindi and Arabic.
- **Speaker tagging.** Tap an attendee's name when the speaker changes.
- **Typed notes.** Add notes while recording. Start a note with `Action:` or `Decision:` and it goes straight into that section of the minutes.
- **Three ways to write minutes:**
  - **With your Claude app (no API key).** Tap **Use my Claude app**, copy the meeting, paste it into the Claude app or claude.ai, then paste Claude's reply back. It's free with your claude.ai account.
  - **Automatic AI minutes.** Add a Claude API key in Settings and Claude writes polished minutes in one tap, fixing speech-recognition mistakes along the way.
  - **Basic minutes.** These need no key and no internet. They are written on the phone using keyword and importance rules.
- **Edit, then share.** Share sheet (WhatsApp, Email, Teams…), copy, Word file (.doc), email, or PDF via Print.
- **History.** Every meeting is saved on the phone. You can reopen it, edit the transcript, continue recording, or regenerate the minutes.
- **Optional audio backup.** Save a recording of the meeting next to the transcript.
- The screen stays on while recording, so transcription doesn't stop.

## Install on your phone

The app has to be served over **HTTPS**. The easiest free option is GitHub Pages:

1. On GitHub open **Settings → Pages** for this repository.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick the branch, keep folder `/ (root)`, and click **Save**.
3. After a minute the app is at `https://<your-user>.github.io/<repo>/meeting-minutes/`.

Other options: drag the `meeting-minutes` folder onto <https://app.netlify.com/drop>, or use any static web host.

Then on the phone (or scan [`install-qr.png`](install-qr.png), which opens the GitHub Pages address for this repository):

- **Android (Chrome):** open the link, then tap **⋮ → Install app** (or *Add to Home screen*).
- **iPhone (Safari):** open the link, then tap **Share → Add to Home Screen**.

The first time you record, allow microphone access.

## Using it

1. Tap **New meeting**. Enter the title, attendees and agenda (optional), then tap **Start listening**.
2. Put the phone in the middle of the table. Tap names when speakers change, and add notes if you like.
3. Tap **Finish**, then **Generate minutes**.
4. Review it, tap **Edit** to fix anything, then **Share** or export it.

## AI minutes with your Claude app (no API key)

1. Open a meeting and tap **Use my Claude app**.
2. Tap **Copy for Claude** (or **Share to Claude app**), then **Open Claude**. Paste into a new chat and send.
3. Copy Claude's reply with its **Copy** button, go back to Minutes, tap **Paste**, then **Use these minutes**.

The app adds the meeting title, date and attendees at the top, and drops any chat-style introduction from Claude's reply.

## Automatic AI minutes with a Claude API key

1. Sign in at <https://console.anthropic.com>. Add credit under **Billing**: API use is paid separately, and a claude.ai subscription doesn't include it.
2. Open **API keys → Create key** and copy the key. It starts with `sk-ant-`.
3. In the app, open **⚙ Settings** (or tap **Add Claude key** on a meeting), paste the key and tap **Save**.

The app checks the key straight away, at no cost, and tells you whether it works. If the key is wrong or the account has no credit, it says so, and you can fix it under ⚙ Settings.

The key is stored only on your phone. When you tap *Generate minutes*, the transcript is sent directly from your phone to Anthropic's API, and the minutes stream in as they're written.

## Tips and limitations

- Live transcription uses the browser's speech service. On most phones (Chrome on Android, Safari on iPhone) **it needs an internet connection** while recording.
- Speech recognition labels who is speaking only when you tap a name; it can't tell voices apart by itself.
- Some Android phones can't record audio and transcribe at the same time. If transcription stops when *Save audio* is on, turn that setting off.
- No microphone support in your browser? Use **Paste or type a transcript instead** on the New meeting screen. You can paste a transcript from Zoom, Teams or Meet, for example.
- Keep the app open on screen during the meeting; phones pause the microphone for background web apps.

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css` | App screens and styling |
| `app.js` | Recording, screens, sharing and settings |
| `minutes.js` | Claude minutes, offline minutes and Markdown rendering |
| `store.js` | On-device storage (IndexedDB) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app and offline support |
