// Offscreen document for playing audio (bypasses CSP restrictions)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'playAudio') {
    playAudio(message.url, message.volume || 1);
    sendResponse({ success: true });
  }
  return true;
});

function playAudio(url, volume) {
  const audio = new Audio(url);
  audio.volume = volume;

  audio.addEventListener('canplaythrough', () => {
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  });

  audio.addEventListener('error', (e) => {
    console.error('Audio loading error:', e);
  });
}
