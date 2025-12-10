// Elements
const statusEl = document.getElementById('status');
const activateBtn = document.getElementById('activate-btn');
const settingsBtn = document.getElementById('settings-btn');

// Settings button
settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Activate on current page
activateBtn.addEventListener('click', async () => {
  activateBtn.disabled = true;
  activateBtn.textContent = '⏳ Activating...';
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      statusEl.className = 'status warn';
      statusEl.innerHTML = '⚠️ Cannot run on this page';
      activateBtn.textContent = '🔍 Analyze This Page';
      activateBtn.disabled = false;
      return;
    }
    
    // Inject CSS first
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content/overlay.css']
    });
    
    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });
    
    // Close popup - button will appear on page
    window.close();
    
  } catch (err) {
    console.error('Inject error:', err);
    statusEl.className = 'status warn';
    statusEl.innerHTML = '⚠️ Could not activate<br><small>' + err.message + '</small>';
    activateBtn.textContent = '🔍 Analyze This Page';
    activateBtn.disabled = false;
  }
});

// Check status
chrome.runtime.sendMessage({ type: 'CHECK_READY' }, (res) => {
  // Handle case where background didn't respond
  if (chrome.runtime.lastError || !res) {
    statusEl.className = 'status warn';
    statusEl.innerHTML = '⚠️ Extension loading...<br>Try again';
    activateBtn.disabled = true;
    return;
  }
  
  if (res.ready) {
    statusEl.className = 'status ready';
    statusEl.innerHTML = '✅ Ready';
  } else if (!res.hasApiKey) {
    statusEl.className = 'status warn';
    statusEl.innerHTML = '⚠️ No API key<br>Check config.js';
    activateBtn.disabled = true;
  } else {
    statusEl.className = 'status warn';
    statusEl.innerHTML = '⚠️ Paste your CV in Settings';
    activateBtn.disabled = true;
  }
});
