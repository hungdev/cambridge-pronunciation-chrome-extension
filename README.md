# Cambridge Translator - Chrome Extension

Translation extension similar to Google Translate but uses pronunciation from Cambridge Dictionary.

## Features

- Translate text with multiple languages
- Pronunciation from Cambridge Dictionary (UK/US)
- Display IPA pronunciation
- Select text on webpage for quick translation
- Quick translation tooltip when selecting text
- Context menu (right-click) to translate

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the folder containing this extension
5. Extension will appear in the toolbar

## Usage Guide

### Method 1: Use Popup
1. Click the extension icon in the toolbar
2. Enter or paste the text to translate
3. Select source and target language
4. Click "Translate"
5. For single English words, click the pronunciation button to hear from Cambridge

### Method 2: Select text on webpage
1. Select (highlight) text on any webpage
2. Quick translate icon will appear
3. Click the icon to open popup with selected text
4. Or right-click and select "Translate with Cambridge Translator"

### Shortcuts
- `Ctrl + Enter`: Translate text in popup

## File Structure

```
translate/
├── manifest.json          # Extension configuration
├── popup.html            # Popup interface
├── popup.js              # Popup logic
├── popup.css             # Popup style
├── background.js         # Service worker, fetch Cambridge data
├── content.js            # Script running on webpage
├── content.css           # Style for tooltip
├── icons/                # Icons for extension
└── README.md             # This file
```

## Create Icons

You need to create 3 PNG icon files:
- `icons/icon16.png` (16x16px)
- `icons/icon48.png` (48x48px)
- `icons/icon128.png` (128x128px)

You can:
1. Create with Photoshop/GIMP/Figma
2. Use online tool like https://www.favicon-generator.org/
3. Or temporarily download icon from internet

## How It Works

### Translate Text
- Use Google Translate API (free tier) to translate text

### Cambridge Pronunciation
1. Extension fetches Cambridge dictionary page (example: https://dictionary.cambridge.org/dictionary/english/favorite)
2. Parse HTML to extract:
   - IPA pronunciation (example: /ˈfeɪ.vər.ɪt/)
   - MP3 audio file URL (prefer US, fallback UK)
3. Play audio when user clicks pronunciation button

### Background Service Worker
- File `background.js` handles fetching data from Cambridge
- Bypass CORS by fetching in background context
- Parse HTML to find pronunciation and audio URL

## Notes

1. **Icons**: You need to add icon files to the `icons/` folder for the extension to display correctly
2. **Cambridge API**: Extension scrapes directly from Cambridge website, may break if Cambridge changes HTML structure
3. **Google Translate**: Uses free endpoint, may be rate limited if used too much
4. **Permissions**: Extension needs access to `dictionary.cambridge.org` and `translate.googleapis.com`

## Possible Improvements

- [ ] Cache translation and pronunciation results
- [ ] Add translation history
- [ ] Allow selection of UK or US accent
- [ ] Add more languages
- [ ] Dark mode
- [ ] Custom keyboard shortcuts
- [ ] Save favorite vocabulary

## Troubleshooting

### Extension not loading
- Check Chrome version (needs v88+)
- Check errors in `chrome://extensions/`
- Reload extension

### No pronunciation
- Check if word exists in Cambridge Dictionary
- Open console to see errors (F12 in popup)
- Try different word (example: "hello", "favorite")

### Cannot translate
- Check internet connection
- Google Translate API may be blocked
- Try reloading extension

## License

MIT License - Free to use and modify
