// Content script - runs on web pages
let selectedText = '';
let translationPopup = null;
let tooltip = null;

// Default settings
let settings = {
  primaryLang: 'vi',
  popupMode: 'icon', // 'icon', 'immediate', 'off'
  enableCambridgePronunciation: true,
  autoPlayAudio: false,
  showPhonetic: true
};

// Load settings
async function loadSettings() {
  try {
    const saved = await chrome.storage.local.get(settings);
    settings = { ...settings, ...saved };
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load settings on init
loadSettings();

// Listen for text selection
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    sendResponse({ text: selectedText });
  }
  if (request.action === 'settingsChanged') {
    // Reload settings when changed
    loadSettings();
  }
  return true;
});

// Create inline translation popup (like Google Translate)
function createTranslationPopup() {
  const popup = document.createElement('div');
  popup.id = 'cambridge-translation-popup';
  popup.style.cssText = `
    position: absolute;
    display: none;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    z-index: 999999;
    min-width: 320px;
    max-width: 480px;
    max-height: 500px;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #202124;
  `;

  popup.innerHTML = `
    <div style="padding: 16px;">
      <div id="popup-loading" style="text-align: center; padding: 20px;">
        <div style="width: 30px; height: 30px; border: 3px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div>
      </div>
      <div id="popup-content" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;" id="popup-word"></div>

            <!-- Google TTS Pronunciation (for phrases/sentences) -->
            <div id="popup-pron-google" style="display: none; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #34a853;">
                <span style="font-weight: 600; font-size: 13px; min-width: 100px;">🔊 Pronunciation</span>
                <button id="popup-play-audio-google" style="background: #34a853; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; padding: 0; margin-left: auto; align-items: center; justify-content: center;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" style="margin-left: 1px;">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- US Pronunciation -->
            <div id="popup-pron-us" style="display: none; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #1a73e8;">
                <span style="font-weight: 600; font-size: 13px; min-width: 40px;">🇺🇸 US</span>
                <span style="color: #5f6368; font-style: italic; font-size: 14px;" id="popup-phonetic-us"></span>
                <button id="popup-play-audio-us" style="background: #1a73e8; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: none; padding: 0; margin-left: auto; display: flex; align-items: center; justify-content: center;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" style="margin-left: 1px;">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- UK Pronunciation -->
            <div id="popup-pron-uk" style="display: none; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #1a73e8;">
                <span style="font-weight: 600; font-size: 13px; min-width: 40px;">🇬🇧 UK</span>
                <span style="color: #5f6368; font-style: italic; font-size: 14px;" id="popup-phonetic-uk"></span>
                <button id="popup-play-audio-uk" style="background: #1a73e8; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: none; padding: 0; margin-left: auto; display: flex; align-items: center; justify-content: center;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" style="margin-left: 1px;">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <button id="popup-close" style="background: none; border: none; cursor: pointer; padding: 4px; color: #5f6368; font-size: 20px;">&times;</button>
        </div>

        <!-- Definitions -->
        <div id="popup-definitions" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed;">
          <div style="color: #5f6368; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">📖 Definitions</div>
          <div id="popup-definitions-list"></div>
        </div>

        <div style="padding-top: 12px; border-top: 1px solid #e8eaed;">
          <div style="color: #5f6368; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Translation</div>
          <div style="font-size: 16px; line-height: 1.5;" id="popup-translation"></div>
        </div>
      </div>
      <div id="popup-error" style="display: none; color: #c5221f; padding: 12px; background: #fce8e6; border-radius: 4px;"></div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(popup);

  // Close button
  popup.querySelector('#popup-close').addEventListener('click', () => {
    hideTranslationPopup();
  });

  // Play audio buttons with loading state
  popup.querySelector('#popup-play-audio-google').addEventListener('click', function() {
    const audioUrl = this.dataset.audioUrl;
    if (audioUrl) {
      playAudioWithLoadingState(audioUrl, this);
    }
  });

  popup.querySelector('#popup-play-audio-us').addEventListener('click', function() {
    const audioUrl = this.dataset.audioUrl;
    if (audioUrl) {
      playAudioWithLoadingState(audioUrl, this);
    }
  });

  popup.querySelector('#popup-play-audio-uk').addEventListener('click', function() {
    const audioUrl = this.dataset.audioUrl;
    if (audioUrl) {
      playAudioWithLoadingState(audioUrl, this);
    }
  });

  // Helper function to play audio with button loading state
  async function playAudioWithLoadingState(url, button) {
    const originalHTML = button.innerHTML;

    // Show loading spinner
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="animation: spin 0.8s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
      </svg>
    `;
    button.disabled = true;
    button.style.opacity = '0.7';

    try {
      // Use background script to play audio via offscreen document (bypasses CSP)
      await chrome.runtime.sendMessage({
        action: 'playAudioFromContent',
        audioUrl: url,
        volume: 1
      });

      // Restore button after audio starts playing
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.disabled = false;
        button.style.opacity = '1';
      }, 500);
    } catch (err) {
      console.error('Error playing audio:', err);
      button.innerHTML = originalHTML;
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  return popup;
}

function showTranslationPopup(x, y, text) {
  if (!translationPopup) {
    translationPopup = createTranslationPopup();
  }

  // Position popup
  translationPopup.style.left = x + 'px';
  translationPopup.style.top = (y + 10) + 'px';
  translationPopup.style.display = 'block';

  // Show loading ONLY if it's the first time (no content yet)
  const hasContent = translationPopup.querySelector('#popup-content').style.display === 'block';

  if (!hasContent) {
    translationPopup.querySelector('#popup-loading').style.display = 'block';
    translationPopup.querySelector('#popup-content').style.display = 'none';
  }

  translationPopup.querySelector('#popup-error').style.display = 'none';

  // Translate text
  translateText(text);
}

function hideTranslationPopup() {
  if (translationPopup) {
    translationPopup.style.display = 'none';
  }
}

async function translateText(text) {
  try {
    // Send message to background to translate
    const response = await chrome.runtime.sendMessage({
      action: 'translateInline',
      text: text
    });

    if (response && response.translation) {
      displayTranslation(response);
    } else {
      showError('Unable to translate text');
    }
  } catch (error) {
    console.error('Translation error:', error);
    showError('Error: ' + error.message);
  }
}

function displayTranslation(data) {
  const popup = translationPopup;

  popup.querySelector('#popup-loading').style.display = 'none';
  popup.querySelector('#popup-content').style.display = 'block';

  popup.querySelector('#popup-word').textContent = data.text;
  popup.querySelector('#popup-translation').textContent = data.translation;

  // Google TTS Pronunciation (for phrases/sentences)
  const pronGoogle = popup.querySelector('#popup-pron-google');
  const audioBtnGoogle = popup.querySelector('#popup-play-audio-google');

  if (data.isGoogleTTS && data.audioUrl && settings.enableCambridgePronunciation) {
    pronGoogle.style.display = 'block';
    audioBtnGoogle.dataset.audioUrl = data.audioUrl;

    // Auto play if enabled
    if (settings.autoPlayAudio) {
      chrome.runtime.sendMessage({
        action: 'playAudioFromContent',
        audioUrl: data.audioUrl,
        volume: 1
      }).catch(err => console.error('Error auto-playing audio:', err));
    }
  } else {
    pronGoogle.style.display = 'none';
  }

  // US Pronunciation
  const pronUS = popup.querySelector('#popup-pron-us');
  const phoneticUS = popup.querySelector('#popup-phonetic-us');
  const audioBtnUS = popup.querySelector('#popup-play-audio-us');

  if (data.phoneticUS && settings.showPhonetic) {
    pronUS.style.display = 'block';
    phoneticUS.textContent = data.phoneticUS;

    if (data.audioUrlUS && settings.enableCambridgePronunciation) {
      audioBtnUS.style.display = 'flex';
      audioBtnUS.dataset.audioUrl = data.audioUrlUS;

      // Auto play US if enabled
      if (settings.autoPlayAudio) {
        chrome.runtime.sendMessage({
          action: 'playAudioFromContent',
          audioUrl: data.audioUrlUS,
          volume: 1
        }).catch(err => console.error('Error auto-playing audio:', err));
      }
    } else {
      audioBtnUS.style.display = 'none';
    }
  } else {
    pronUS.style.display = 'none';
  }

  // UK Pronunciation
  const pronUK = popup.querySelector('#popup-pron-uk');
  const phoneticUK = popup.querySelector('#popup-phonetic-uk');
  const audioBtnUK = popup.querySelector('#popup-play-audio-uk');

  if (data.phoneticUK && settings.showPhonetic) {
    pronUK.style.display = 'block';
    phoneticUK.textContent = data.phoneticUK;

    if (data.audioUrlUK && settings.enableCambridgePronunciation) {
      audioBtnUK.style.display = 'flex';
      audioBtnUK.dataset.audioUrl = data.audioUrlUK;
    } else {
      audioBtnUK.style.display = 'none';
    }
  } else {
    pronUK.style.display = 'none';
  }

  // Definitions
  const definitionsDiv = popup.querySelector('#popup-definitions');
  const definitionsList = popup.querySelector('#popup-definitions-list');

  if (data.definitions && data.definitions.length > 0) {
    definitionsDiv.style.display = 'block';
    definitionsList.innerHTML = '';

    data.definitions.forEach((def) => {
      let html = '<div style="margin-bottom: 12px; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #34a853;">';

      // Word type
      if (def.wordType) {
        html += `<div style="display: inline-block; background: #34a853; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; margin-bottom: 4px;">${def.wordType}</div>`;
      }

      // Translations (Google format: array of Vietnamese translations)
      if (def.translations && def.translations.length > 0) {
        html += `<div style="color: #202124; font-size: 13px; line-height: 1.5; margin-bottom: 4px;">${def.translations.join(', ')}</div>`;
      }

      // Old format support (Cambridge)
      if (def.definition) {
        html += `<div style="color: #202124; font-size: 13px; line-height: 1.5; margin-bottom: 4px;">${def.definition}</div>`;
      }

      if (def.translation) {
        html += `<div style="color: #5f6368; font-size: 12px; font-style: italic;">${def.translation}</div>`;
      }

      // Examples
      if (def.examples && def.examples.length > 0) {
        html += '<div style="margin-top: 6px;">';
        def.examples.forEach(example => {
          html += `<div style="color: #5f6368; font-size: 12px; font-style: italic; margin: 3px 0; padding-left: 8px; border-left: 2px solid #dadce0;">"${example}"</div>`;
        });
        html += '</div>';
      }

      html += '</div>';
      definitionsList.innerHTML += html;
    });
  } else {
    definitionsDiv.style.display = 'none';
  }
}

function showError(message) {
  const popup = translationPopup;
  popup.querySelector('#popup-loading').style.display = 'none';
  popup.querySelector('#popup-content').style.display = 'none';
  popup.querySelector('#popup-error').style.display = 'block';
  popup.querySelector('#popup-error').textContent = message;
}

// Create tooltip icon
function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'cambridge-translator-tooltip';
  tooltip.innerHTML = `
    <button id="quick-translate-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    </button>
  `;
  tooltip.style.cssText = `
    position: absolute;
    display: none;
    background: #1a73e8;
    color: white;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    z-index: 999999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(tooltip);

  const btn = tooltip.querySelector('#quick-translate-btn');
  btn.style.cssText = `
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (selectedText) {
      // Show inline translation popup
      const rect = tooltip.getBoundingClientRect();
      showTranslationPopup(rect.left + window.scrollX, rect.bottom + window.scrollY, selectedText);
    }
    hideTooltip();
  });
}

function showTooltip(x, y) {
  if (!tooltip) createTooltip();

  tooltip.style.display = 'block';
  tooltip.style.left = x + 'px';
  tooltip.style.top = (y - 50) + 'px';
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// Handle text selection
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (text.length > 0) {
    selectedText = text;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    // Check popup mode setting
    if (settings.popupMode === 'off') {
      // Do nothing
      return;
    } else if (settings.popupMode === 'immediate') {
      // Show translation popup immediately
      showTranslationPopup(x, y + rect.height, text);
    } else {
      // Show tooltip icon (default)
      showTooltip(x, y);
    }
  } else {
    hideTooltip();
  }
});

// Hide tooltip and popup when clicking outside
document.addEventListener('mousedown', (e) => {
  if (tooltip && !tooltip.contains(e.target)) {
    hideTooltip();
  }
  if (translationPopup && !translationPopup.contains(e.target) && (!tooltip || !tooltip.contains(e.target))) {
    hideTranslationPopup();
  }
});
