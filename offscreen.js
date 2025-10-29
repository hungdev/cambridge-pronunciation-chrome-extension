// Offscreen document for playing audio (bypasses CSP restrictions)
console.log('Offscreen document loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'playAudio') {
    playAudio(message.url, message.volume || 1);
    sendResponse({ success: true });
  }
  return true;
});

function playAudio(url, volume) {
  console.log('Playing audio:', url);

  const audio = new Audio(url);
  audio.volume = volume;

  audio.addEventListener('canplaythrough', () => {
    console.log('Audio ready to play');
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  });

  audio.addEventListener('error', (e) => {
    console.error('Audio loading error:', e);
  });

  audio.addEventListener('ended', () => {
    console.log('Audio playback finished');
  });
}
