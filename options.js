// Options page script

// Default settings
const DEFAULT_SETTINGS = {
  primaryLang: 'vi',
  popupMode: 'icon', // 'icon', 'immediate', 'off'
  enableCambridgePronunciation: true,
  autoPlayAudio: false,
  showPhonetic: true
};

// Load settings when page opens
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();

  // Save button
  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // Reset button
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

    // Set primary language
    document.getElementById('primaryLang').value = settings.primaryLang;

    // Set popup mode
    document.getElementById(`mode-${settings.popupMode}`).checked = true;

    // Set checkboxes
    document.getElementById('enableCambridgePronunciation').checked = settings.enableCambridgePronunciation;
    document.getElementById('autoPlayAudio').checked = settings.autoPlayAudio;
    document.getElementById('showPhonetic').checked = settings.showPhonetic;

  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

async function saveSettings() {
  try {
    const settings = {
      primaryLang: document.getElementById('primaryLang').value,
      popupMode: document.querySelector('input[name="popupMode"]:checked').value,
      enableCambridgePronunciation: document.getElementById('enableCambridgePronunciation').checked,
      autoPlayAudio: document.getElementById('autoPlayAudio').checked,
      showPhonetic: document.getElementById('showPhonetic').checked
    };

    await chrome.storage.local.set(settings);

    showStatus('Settings saved!', 'success');

    // Notify content scripts to reload settings
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {
        // Ignore errors for tabs that don't have content script
      });
    });

  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
}

async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    try {
      await chrome.storage.local.set(DEFAULT_SETTINGS);
      await loadSettings();
      showStatus('Settings reset to default!', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus('Error resetting settings', 'error');
    }
  }
}

function showStatus(message, type = 'success') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';

  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}
