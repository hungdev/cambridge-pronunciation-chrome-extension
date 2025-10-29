// Background service worker

// Offscreen document management for audio playback
async function createOffscreenDocument() {
  // Check if offscreen document already exists
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing pronunciation audio from Cambridge Dictionary'
  });
}

// Play audio using offscreen document (bypasses CSP)
async function playAudio(audioUrl, volume = 1) {
  try {
    await createOffscreenDocument();
    await chrome.runtime.sendMessage({
      action: 'playAudio',
      url: audioUrl,
      volume: volume
    });
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchCambridgeData') {
    fetchCambridgeData(request.word)
      .then(data => sendResponse(data))
      .catch(error => {
        console.error('Error in background:', error);
        sendResponse(null);
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'translateInline') {
    // Translate text for inline popup
    translateTextInline(request.text)
      .then(data => sendResponse(data))
      .catch(error => {
        console.error('Error translating inline:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'translateText') {
    // Open popup when quick translate is clicked
    chrome.action.openPopup();
  }

  if (request.action === 'playAudioFromContent') {
    // Play audio requested from content script
    playAudio(request.audioUrl, request.volume || 1)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function translateTextInline(text) {
  try {
    // Get target language from settings
    const settings = await chrome.storage.local.get({ primaryLang: 'vi' });
    const targetLang = settings.primaryLang;

    // Translate using Google Translate API with definitions
    const params = [
      'client=gtx',
      'sl=auto',
      `tl=${targetLang}`,
      'dt=t',  // translation
      'dt=bd', // dictionary/definitions
      `q=${encodeURIComponent(text)}`
    ];
    const url = `https://translate.googleapis.com/translate_a/single?${params.join('&')}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();

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
        const wordType = entry[0];
        const translations = entry[1]; // Direct array: ["nhân dân", "thuộc về dân chúng", ...]

        return {
          wordType,
          translations: Array.isArray(translations) ? translations : []
        };
      });
    }

    // Check if it's a single ENGLISH word (for Cambridge pronunciation)
    const words = text.trim().split(/\s+/);
    const isSingleEnglishWord = words.length === 1 && /^[a-zA-Z]+$/.test(text.trim());

    let pronunciation = null;
    let audioUrl = null;

    // Only fetch Cambridge data for single English words
    if (isSingleEnglishWord) {
      const word = text.trim().toLowerCase();
      const cambridgeData = await fetchCambridgeData(word);
      if (cambridgeData) {
        pronunciation = cambridgeData.phonetic;
        audioUrl = cambridgeData.audioUrl;

        // Return both US and UK data with Google definitions
        return {
          text,
          translation,
          phonetic: pronunciation,
          phoneticUS: cambridgeData.phoneticUS,
          phoneticUK: cambridgeData.phoneticUK,
          audioUrl,
          audioUrlUS: cambridgeData.audioUrlUS,
          audioUrlUK: cambridgeData.audioUrlUK,
          definitions: googleDefinitions, // Use Google definitions
          isSingleWord: true
        };
      }

      // If Cambridge fails, still return Google definitions
      return {
        text,
        translation,
        phonetic: null,
        phoneticUS: null,
        phoneticUK: null,
        audioUrl: null,
        audioUrlUS: null,
        audioUrlUK: null,
        definitions: googleDefinitions,
        isSingleWord: true
      };
    }

    // For all other cases (multi-word, other languages, phrases)
    // Use Google Translate TTS for pronunciation
    const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=en&q=${encodeURIComponent(text)}`;

    return {
      text,
      translation,
      phonetic: null,
      phoneticUS: null,
      phoneticUK: null,
      audioUrl: googleTTSUrl,  // Google TTS for phrases/sentences
      audioUrlUS: null,
      audioUrlUK: null,
      definitions: googleDefinitions,
      isSingleWord: false,
      isGoogleTTS: true  // Flag to indicate it's from Google TTS
    };

  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

async function fetchCambridgeData(word) {
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;
    console.log('Fetching from Cambridge:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error('Cambridge fetch failed:', response.status);
      return null;
    }

    const html = await response.text();
    console.log('Cambridge HTML length:', html.length);

    // Debug: Log samples of HTML around US pronunciation section
    const usIndex = html.indexOf('class="us dpron');
    if (usIndex !== -1) {
      console.log('✅ Found US pronunciation section at index:', usIndex);
      console.log('US section sample:', html.substring(usIndex, usIndex + 500));
    } else {
      console.log('⚠️ US pronunciation section not found');
    }

    // Check for audio elements
    const audioIndex = html.indexOf('data-src-mp3');
    if (audioIndex !== -1) {
      console.log('✅ Found data-src-mp3 at index:', audioIndex);
      console.log('Audio sample:', html.substring(Math.max(0, audioIndex - 100), audioIndex + 300));
    } else {
      console.log('⚠️ data-src-mp3 not found');
    }

    // Parse HTML to extract phonetic and audio URL
    let phonetic = null;
    let audioUrl = null;

    // Find BOTH US and UK phonetic
    let phoneticUS = null;
    let phoneticUK = null;

    // US phonetic patterns
    const usPhoneticPatterns = [
      /<span class="us dpron-i ">.*?<span class="ipa dipa lpr-2 lpl-1">([^<]+)<\/span>/s,
      /<div class="us dpron-i">.*?<span class="ipa dipa lpr-2 lpl-1">([^<]+)<\/span>/s
    ];

    for (const pattern of usPhoneticPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        phoneticUS = match[1].trim();
        console.log('Found US phonetic:', phoneticUS);
        break;
      }
    }

    // UK phonetic patterns
    const ukPhoneticPatterns = [
      /<span class="uk dpron-i ">.*?<span class="ipa dipa lpr-2 lpl-1">([^<]+)<\/span>/s,
      /<div class="uk dpron-i">.*?<span class="ipa dipa lpr-2 lpl-1">([^<]+)<\/span>/s
    ];

    for (const pattern of ukPhoneticPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        phoneticUK = match[1].trim();
        console.log('Found UK phonetic:', phoneticUK);
        break;
      }
    }

    // For backward compatibility, set phonetic to US (preferred)
    phonetic = phoneticUS;

    // Parse definitions with word types
    const definitions = [];

    // Pattern to match definition blocks with word type
    const defBlockPattern = /<div class="def-block[^"]*">([\s\S]*?)<\/div>/g;
    const defBlocks = html.matchAll(defBlockPattern);

    for (const block of defBlocks) {
      const blockHtml = block[1];

      // Extract word type (noun, verb, adjective, etc.)
      const wordTypeMatch = blockHtml.match(/<span class="pos dpos">([^<]+)<\/span>/);
      const wordType = wordTypeMatch ? wordTypeMatch[1].trim() : null;

      // Extract definition
      const defMatch = blockHtml.match(/<div class="def ddef_d[^"]*">([^<]+)<\/div>/);
      const definition = defMatch ? defMatch[1].trim() : null;

      // Extract examples
      const examplePattern = /<span class="eg deg">([^<]+)<\/span>/g;
      const examples = Array.from(blockHtml.matchAll(examplePattern)).map(m => m[1].trim());

      // Extract translation (if available)
      const transMatch = blockHtml.match(/<span class="trans dtrans[^"]*">([^<]+)<\/span>/);
      const translation = transMatch ? transMatch[1].trim() : null;

      if (definition) {
        definitions.push({
          wordType,
          definition,
          examples: examples.slice(0, 2), // Limit to 2 examples per definition
          translation
        });
      }
    }

    console.log('Parsed definitions:', definitions.length);

    // Find BOTH US and UK pronunciation - try multiple strategies

    // Strategy 1: Find ALL data-src-mp3 attributes
    let allAudioMatches = html.matchAll(/data-src-mp3="([^"]+)"/g);
    let audioUrls = Array.from(allAudioMatches).map(match => match[1]);

    // Strategy 2: Also check for data-src-ogg
    const allOggMatches = html.matchAll(/data-src-ogg="([^"]+)"/g);
    const oggUrls = Array.from(allOggMatches).map(match => match[1]);
    audioUrls = [...audioUrls, ...oggUrls];

    // Strategy 3: Check for source tags
    const sourceMatches = html.matchAll(/<source[^>]*src="([^"]+)"[^>]*>/g);
    const sourceUrls = Array.from(sourceMatches).map(match => match[1]);
    audioUrls = [...audioUrls, ...sourceUrls];

    // Strategy 4: Check for amp-audio (Cambridge might use AMP)
    const ampMatches = html.matchAll(/<amp-audio[^>]*src="([^"]+)"[^>]*>/g);
    const ampUrls = Array.from(ampMatches).map(match => match[1]);
    audioUrls = [...audioUrls, ...ampUrls];

    console.log('All audio URLs found:', audioUrls);

    // Find BOTH US and UK audio
    const usAudioUrl = audioUrls.find(url =>
      url.includes('us_pron') ||
      url.includes('/us/') ||
      url.includes('_us.') ||
      url.includes('us.mp3') ||
      url.includes('us.ogg')
    );

    const ukAudioUrl = audioUrls.find(url =>
      url.includes('uk_pron') ||
      url.includes('/uk/') ||
      url.includes('_uk.') ||
      url.includes('uk.mp3') ||
      url.includes('uk.ogg')
    );

    let audioUrlUS = null;
    let audioUrlUK = null;

    if (usAudioUrl) {
      audioUrlUS = usAudioUrl.startsWith('http') ? usAudioUrl : 'https://dictionary.cambridge.org' + usAudioUrl;
      console.log('✅ Found US audio:', audioUrlUS);
    }

    if (ukAudioUrl) {
      audioUrlUK = ukAudioUrl.startsWith('http') ? ukAudioUrl : 'https://dictionary.cambridge.org' + ukAudioUrl;
      console.log('✅ Found UK audio:', audioUrlUK);
    }

    // For backward compatibility, set audioUrl to US (preferred)
    audioUrl = audioUrlUS;

    // If no audio found in HTML, try constructing the URL directly
    // Cambridge uses predictable URLs for audio files
    if (!audioUrl) {
      console.log('⚠️ Audio not found in HTML, trying constructed URLs...');

      // Try common Cambridge audio URL patterns - US ONLY
      const possibleUrls = [
        // Standard paths
        `https://dictionary.cambridge.org/us/media/english/us_pron/${word.charAt(0)}/${word}.mp3`,
        `https://dictionary.cambridge.org/media/english/us_pron/${word.charAt(0)}/${word}.mp3`,
        // Alternative paths with different structures
        `https://dictionary.cambridge.org/us/media/english-chinese-simplified/us_pron/${word.charAt(0)}/${word}.mp3`,
        `https://dictionary.cambridge.org/media/english-chinese-simplified/us_pron/${word.charAt(0)}/${word}.mp3`,
        // Try with ogg format
        `https://dictionary.cambridge.org/us/media/english/us_pron_ogg/${word.charAt(0)}/${word}.ogg`,
        // Direct media URLs
        `https://dictionary.cambridge.org/zhs/media/english/us_pron/${word.charAt(0)}/${word}.mp3`
      ];

      // Try to verify one of these URLs works
      for (const testUrl of possibleUrls) {
        try {
          console.log('Testing URL:', testUrl);
          const audioTest = await fetch(testUrl, { method: 'HEAD' });
          if (audioTest.ok) {
            audioUrl = testUrl;
            console.log('✅ Found working audio URL:', audioUrl);
            break;
          } else {
            console.log('❌ Failed:', audioTest.status);
          }
        } catch (e) {
          console.log('❌ Error:', e.message);
          // Continue to next URL
        }
      }

    }

    const result = {
      phonetic: phonetic ? `/${phonetic}/` : null,
      phoneticUS: phoneticUS ? `/${phoneticUS}/` : null,
      phoneticUK: phoneticUK ? `/${phoneticUK}/` : null,
      audioUrl,
      audioUrlUS,
      audioUrlUK,
      definitions: definitions.length > 0 ? definitions : null
    };

    console.log('Cambridge result:', result);
    console.log('Definitions found:', definitions.length);
    if (definitions.length > 0) {
      console.log('Sample definition:', definitions[0]);
    }
    return result;

  } catch (error) {
    console.error('Error fetching Cambridge data:', error);
    return null;
  }
}

// Setup context menu on install
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Setup context menu on startup
chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

function setupContextMenu() {
  if (!chrome.contextMenus) {
    console.log('Context menus API not available');
    return;
  }

  chrome.contextMenus.create({
    id: 'translateWithCambridge',
    title: 'Translate with Cambridge Translator',
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) {
      // Ignore "already exists" error
      if (!chrome.runtime.lastError.message.includes('already exists')) {
        console.log('Context menu error:', chrome.runtime.lastError.message);
      }
    }
  });
}

// Handle context menu clicks
chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  if (info.menuItemId === 'translateWithCambridge') {
    // Store selected text for popup to use
    chrome.storage.local.set({ selectedText: info.selectionText });
  }
});
