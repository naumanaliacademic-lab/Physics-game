# Minutes: Meeting Minutes Taker (mobile app)

An app you install on your phone. It listens to a meeting, writes a live transcript, and turns it into meeting minutes: summary, discussion by agenda item, decisions, an action-item table (owner and due date), open questions and next meeting.

It is a **Progressive Web App (PWA)**, so there's no app store. You open it once in the browser and install it (Android, Windows, Mac) or add it to the Home Screen (iPhone). It then opens like any other app and works offline.

## Features

- **Live listening.** The phone's speech recognition transcribes the meeting as people talk. It works in 20+ languages, including English, Urdu, Hindi and Arabic.
- **Speaker tagging.** Tap an attendee's name when the speaker changes.
- **One-tap notes.** While recording, tap **★ Mark**, **Decision** or **Action** to turn what was just said into a tagged note, or type your own. Tagged notes go straight into that section of the minutes.
- **Meeting types.** General, board or committee, team stand-up, 1:1, client or project, school staff meeting, and lesson or lecture notes, each with its own minutes layout. Choose **Brief**, **Standard** or **Detailed** length.
- **Minutes language and glossary.** In Settings, choose the language the minutes are written in (for example English minutes from an Urdu meeting), and list names and terms so AI minutes spell them right.
- **Three ways to write minutes:**
  - **With your Claude app (no API key).** Tap **Use my Claude app**, copy the meeting, paste it into the Claude app or claude.ai, then paste Claude's reply back. It's free with your claude.ai account.
  - **Automatic AI minutes.** Add a Claude API key in Settings and Claude writes polished minutes in one tap, fixing speech-recognition mistakes along the way.
  - **Basic minutes.** These need no key and no internet. They are written on the phone using keyword and importance rules.
- **Edit, then share.** Share sheet (WhatsApp, Email, Teams…), copy, Word file (.doc), email, or PDF via Print.
- **History and search.** Every meeting is saved on the device. Search titles, transcripts and minutes, reopen a meeting, edit the transcript (edits save automatically), continue recording, or regenerate the minutes.
- **Backup.** Save all meetings to a backup file and restore them on another phone (Settings → Backup).
- **Optional audio backup.** Save a recording of the meeting next to the transcript. Audio is saved every 10 seconds, so it survives the app being closed.
- **Reliable recording.** The screen stays on while recording. If the phone locks or you switch apps, listening restarts when you come back and the gap is marked in the transcript.

## Install on your phone

The app has to be served over **HTTPS**. The easiest free option is GitHub Pages:

1. On GitHub open **Settings → Pages** for this repository.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick the branch, keep folder `/ (root)`, and click **Save**.
3. After a minute the app is at `https://<your-user>.github.io/<repo>/meeting-minutes/`.

Other options: drag the `meeting-minutes` folder onto <https://app.netlify.com/drop>, or use any static web host.

**Privacy note for GitHub Pages:** every GitHub Pages project on one account shares the same web address (`<user>.github.io`), and with it the browser storage. Pages from your other projects could read Minutes' saved meetings and a saved Claude API key. If you publish other Pages projects with code you don't fully trust, host Minutes on its own address (Netlify Drop, Cloudflare Pages or a custom domain), or don't save an API key and use **Use my Claude app** instead.

Then on the phone (or scan [`install-qr.png`](install-qr.png), which opens the GitHub Pages address for this repository):

- **Android (Chrome):** open the link, then tap **⋮ → Install app** (or *Add to Home screen*), or tap **Install app** on the Minutes home screen.
- **iPhone, iOS 26 or later (Safari):** open the link, tap **Share → Add to Home Screen**, and switch **off** "Open as Web App" before tapping **Add**. iPhone speech recognition works in Safari but not inside Home Screen web apps, so the icon should open Safari.
- **iPhone, iOS 18 or earlier:** keep using Minutes in Safari and tap **Share → Add to Favourites**. These iOS versions always open Home Screen icons as web apps, where live listening doesn't work.
- **Laptop (Chrome or Edge):** open the link and click the install icon in the address bar.

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

The key is stored on this device, unencrypted, in the app's browser storage (see the GitHub Pages privacy note above). When you tap *Generate minutes*, the transcript is sent directly from your phone to Anthropic's API, and the minutes stream in as they're written.

## Tips and limitations

- Live transcription uses the browser's speech service. On most phones (Chrome on Android, Safari on iPhone) **it needs an internet connection** while recording.
- Speech recognition labels who is speaking only when you tap a name; it can't tell voices apart by itself.
- Some Android phones can't record audio and transcribe at the same time. If transcription stops when *Save audio* is on, turn that setting off.
- **Privacy:** live listening uses the device's speech service, which sends the audio to Google (Android, Chrome) or Apple (iPhone, Safari) to turn it into text. The transcript, minutes and audio are stored only on your device unless you share them or use Claude.
- On iPhone, live listening needs Siri or Dictation turned on (Settings → General → Keyboard → Enable Dictation).
- **Back up your meetings.** They are stored only on the device, and Safari deletes website data for sites you haven't opened for about a week unless they're on the Home Screen. Use Settings → Backup now and then; the app reminds you every two weeks once you have a few meetings.
- No microphone support in your browser? Use **Paste or type a transcript instead** on the New meeting screen. You can paste a transcript from Zoom, Teams or Meet, for example.
- Keep the app open on screen during the meeting; phones pause the microphone for background web apps.

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css` | App screens and styling |
| `app.js` | Recording, screens, sharing and settings |
| `minutes.js` | Meeting types, Claude prompts, offline minutes, Markdown rendering |
| `store.js` | On-device storage (IndexedDB) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app and offline support (change `VERSION` in `sw.js` on every release) |
| `vendor/anthropic-sdk.mjs` | The official Anthropic SDK (0.131.0, MIT), bundled so AI minutes work without a third-party CDN |
