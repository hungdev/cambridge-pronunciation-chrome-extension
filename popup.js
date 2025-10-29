// Popup script
let currentAudioUrl = null;
let currentWord = null;

document.addEventListener('DOMContentLoaded', async () => {
  const sourceText = document.getElementById('sourceText');
  const translateBtn = document.getElementById('translateBtn');
  const playAudio = document.getElementById('playAudio');
  const swapLang = document.getElementById('swapLang');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');
  const settingsBtn = document.getElementById('settingsBtn');

  // Load saved languages and selected text
  const saved = await chrome.storage.local.get(['sourceLang', 'targetLang', 'selectedText']);
  if (saved.sourceLang) sourceLang.value = saved.sourceLang;
  if (saved.targetLang) targetLang.value = saved.targetLang;

  // Check for selected text from context menu first
  if (saved.selectedText) {
    sourceText.value = saved.selectedText;
    // Clear it after loading
    chrome.storage.local.remove('selectedText');
  } else {
    // Otherwise check if there's selected text from content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
      if (response && response.text) {
        sourceText.value = response.text;
      }
    } catch (error) {
      console.log('No selected text or content script not loaded');
    }
  }

  // Translate button click
  translateBtn.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    if (!text) return;

    // Show loading in button instead of overlay
    const originalBtnText = translateBtn.textContent;
    translateBtn.disabled = true;
    translateBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        Translating...
      </div>
    `;

    hideError();

    try {
      const result = await translateText(
        text,
        sourceLang.value,
        targetLang.value
      );

      displayResult(result);
    } catch (error) {
      showError(error.message);
    } finally {
      translateBtn.innerHTML = originalBtnText;
      translateBtn.disabled = false;
    }
  });

  // Play audio buttons
  const playAudioUS = document.getElementById('playAudioUS');
  const playAudioUK = document.getElementById('playAudioUK');

  playAudioUS?.addEventListener('click', () => {
    const audioUrl = playAudioUS.dataset.audioUrl;
    if (audioUrl) {
      playAudioWithButton(audioUrl, playAudioUS);
    }
  });

  playAudioUK?.addEventListener('click', () => {
    const audioUrl = playAudioUK.dataset.audioUrl;
    if (audioUrl) {
      playAudioWithButton(audioUrl, playAudioUK);
    }
  });

  // Swap languages
  swapLang.addEventListener('click', () => {
    if (sourceLang.value === 'auto') return;

    const temp = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = temp;

    // Save to storage
    chrome.storage.local.set({
      sourceLang: sourceLang.value,
      targetLang: targetLang.value
    });
  });

  // Save language selection
  sourceLang.addEventListener('change', () => {
    chrome.storage.local.set({ sourceLang: sourceLang.value });
  });

  targetLang.addEventListener('change', () => {
    chrome.storage.local.set({ targetLang: targetLang.value });
  });

  // Enter to translate
  sourceText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      translateBtn.click();
    }
  });

  // Settings button click
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

async function translateText(text, source, target) {
  // Using Google Translate API with definitions
  const params = [
    `client=gtx`,
    `sl=${source}`,
    `tl=${target}`,
    `dt=t`,  // translation
    `dt=bd`, // dictionary/definitions
    `q=${encodeURIComponent(text)}`
  ];
  const url = `https://translate.googleapis.com/translate_a/single?${params.join('&')}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Error translating text');
  }

  const data = await response.json();
  console.log('Google Translate response:', data);

  // Parse translation - handle both single word and multi-word/sentence
  let translation = '';
  if (data[0] && Array.isArray(data[0])) {
    translation = data[0].map(item => item && item[0] ? item[0] : '').filter(t => t).join('');
  }

  if (!translation) {
    throw new Error('No translation received');
  }

  // Parse definitions from data[1]
  let googleDefinitions = null;
  if (data[1]) {
    googleDefinitions = data[1].map(entry => {
      const wordType = entry[0]; // noun, verb, adjective...
      const translations = entry[1]; // Direct array: ["nhân dân", "thuộc về dân chúng", ...]

      return {
        wordType,
        translations: Array.isArray(translations) ? translations : []
      };
    });
    console.log('Google definitions:', googleDefinitions);
  }

  // Detect if it's a single ENGLISH word for pronunciation
  const words = text.trim().split(/\s+/);
  const isSingleEnglishWord = words.length === 1 && /^[a-zA-Z]+$/.test(text.trim());

  let pronunciation = null;
  let audioUrl = null;

  // Fetch pronunciation ONLY for single English words
  if (isSingleEnglishWord && (source === 'en' || source === 'auto')) {
    currentWord = text.trim().toLowerCase();
    // Fetch Cambridge pronunciation (only for audio)
    const cambridgeData = await getCambridgeData(currentWord);
    if (cambridgeData) {
      pronunciation = cambridgeData.phonetic;
      audioUrl = cambridgeData.audioUrl;
      currentAudioUrl = audioUrl;

      // Return with Google definitions + Cambridge pronunciation
      return {
        text,
        translation,
        pronunciation,
        pronunciationUS: cambridgeData.phoneticUS,
        pronunciationUK: cambridgeData.phoneticUK,
        audioUrl,
        audioUrlUS: cambridgeData.audioUrlUS,
        audioUrlUK: cambridgeData.audioUrlUK,
        definitions: googleDefinitions, // Use Google definitions instead of Cambridge
        isSingleWord: true
      };
    }

    // If Cambridge fails, still return Google definitions
    return {
      text,
      translation,
      pronunciation: null,
      pronunciationUS: null,
      pronunciationUK: null,
      audioUrl: null,
      audioUrlUS: null,
      audioUrlUK: null,
      definitions: googleDefinitions,
      isSingleWord: true
    };
  } else {
    currentWord = null;
    currentAudioUrl = null;
  }

  // Always return translation with Google definitions (works for ALL languages and phrases)
  return {
    text,
    translation,
    pronunciation,
    audioUrl,
    definitions: googleDefinitions,
    isSingleWord: false // Don't show pronunciation section for non-English or multi-word
  };
}

async function getCambridgeData(word) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchCambridgeData',
      word: word
    });

    return response;
  } catch (error) {
    console.error('Error fetching Cambridge data:', error);
    return null;
  }
}

async function getCambridgeAudio(word) {
  try {
    const data = await getCambridgeData(word);
    return data ? data.audioUrl : null;
  } catch (error) {
    console.error('Error fetching Cambridge audio:', error);
    return null;
  }
}

function playAudioFromUrl(url) {
  const audio = new Audio(url);
  audio.play().catch(error => {
    console.error('Error playing audio:', error);
    showError('Unable to play audio');
  });
}

async function playAudioWithButton(url, button) {
  // Save original content
  const originalHTML = button.innerHTML;

  // Show loading spinner in button
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="animation: spin 0.8s linear infinite;">
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

    // Restore button after a short delay
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.disabled = false;
      button.style.opacity = '1';
    }, 500);
  } catch (error) {
    console.error('Error playing audio:', error);
    button.innerHTML = originalHTML;
    button.disabled = false;
    button.style.opacity = '1';
    showError('Unable to play audio');
  }
}

function displayResult(result) {
  const resultSection = document.getElementById('resultSection');
  const pronunciationSection = document.getElementById('pronunciationSection');
  const wordTitle = document.getElementById('wordTitle');
  const translationText = document.getElementById('translationText');

  // US pronunciation elements
  const pronunciationUS = document.getElementById('pronunciationUS');
  const phoneticUS = document.getElementById('phoneticUS');
  const playAudioUS = document.getElementById('playAudioUS');

  // UK pronunciation elements
  const pronunciationUK = document.getElementById('pronunciationUK');
  const phoneticUK = document.getElementById('phoneticUK');
  const playAudioUK = document.getElementById('playAudioUK');

  // Definitions elements
  const definitionsSection = document.getElementById('definitionsSection');
  const definitionsList = document.getElementById('definitionsList');

  translationText.textContent = result.translation;

  if (result.isSingleWord) {
    pronunciationSection.style.display = 'block';
    wordTitle.textContent = result.text;

    // Show US pronunciation if available
    if (result.pronunciationUS || result.audioUrlUS) {
      pronunciationUS.style.display = 'block';
      phoneticUS.textContent = result.pronunciationUS || result.pronunciation || '';
      if (result.audioUrlUS) {
        playAudioUS.style.display = 'flex';
        playAudioUS.dataset.audioUrl = result.audioUrlUS;
      } else {
        playAudioUS.style.display = 'none';
      }
    } else {
      pronunciationUS.style.display = 'none';
    }

    // Show UK pronunciation if available
    if (result.pronunciationUK || result.audioUrlUK) {
      pronunciationUK.style.display = 'block';
      phoneticUK.textContent = result.pronunciationUK || '';
      if (result.audioUrlUK) {
        playAudioUK.style.display = 'flex';
        playAudioUK.dataset.audioUrl = result.audioUrlUK;
      } else {
        playAudioUK.style.display = 'none';
      }
    } else {
      pronunciationUK.style.display = 'none';
    }

    // Show definitions if available (Google Translate format)
    if (result.definitions && result.definitions.length > 0) {
      definitionsSection.style.display = 'block';
      definitionsList.innerHTML = '';

      result.definitions.forEach((def, index) => {
        const defItem = document.createElement('div');
        defItem.className = 'definition-item';

        let html = '';

        // Word type (noun, verb, etc.)
        if (def.wordType) {
          html += `<div class="word-type">${def.wordType}</div>`;
        }

        // Translations (Google format: array of Vietnamese translations)
        if (def.translations && def.translations.length > 0) {
          html += '<div class="definition-text">';
          html += def.translations.join(', ');
          html += '</div>';
        }

        // Old format support (Cambridge)
        if (def.definition) {
          html += `<div class="definition-text">${def.definition}</div>`;
        }

        if (def.translation) {
          html += `<div class="definition-translation">${def.translation}</div>`;
        }

        // Examples
        if (def.examples && def.examples.length > 0) {
          html += '<div class="definition-examples">';
          def.examples.forEach(example => {
            html += `<div class="example-item">"${example}"</div>`;
          });
          html += '</div>';
        }

        defItem.innerHTML = html;
        definitionsList.appendChild(defItem);
      });
    } else {
      definitionsSection.style.display = 'none';
    }
  } else {
    pronunciationSection.style.display = 'none';
    definitionsSection.style.display = 'none';
  }

  resultSection.style.display = 'block';
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  loading.style.display = show ? 'flex' : 'none';
}

function showError(message) {
  const error = document.getElementById('error');
  error.textContent = message;
  error.style.display = 'block';
  setTimeout(() => {
    error.style.display = 'none';
  }, 5000);
}

function hideError() {
  const error = document.getElementById('error');
  error.style.display = 'none';
}
