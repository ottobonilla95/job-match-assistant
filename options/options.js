// Options page - PDF upload only

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileName = document.getElementById('file-name');
const status = document.getElementById('status');
const profileSection = document.getElementById('profile-section');
const profileDisplay = document.getElementById('profile-display');

let cvText = '';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');

// Load saved profile
chrome.storage.sync.get(['profile', 'cvText'], (data) => {
  if (data.profile) showProfile(data.profile);
  if (data.cvText) {
    cvText = data.cvText;
    fileName.textContent = '✓ CV loaded';
    fileName.classList.remove('hidden');
    dropZone.classList.add('success');
  }
});

// Click to upload
dropZone.addEventListener('click', () => fileInput.click());

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// File input
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// Handle PDF - extract and parse automatically
async function handleFile(file) {
  if (!file.name.endsWith('.pdf')) {
    showStatus('Please upload a PDF file', 'error');
    return;
  }
  
  dropZone.classList.add('loading');
  dropZone.classList.remove('success');
  fileName.textContent = 'Reading PDF...';
  fileName.classList.remove('hidden');
  
  try {
    // Extract text from PDF
    cvText = await extractPdfText(file);
    await chrome.storage.sync.set({ cvText });
    
    // Auto-parse with AI
    fileName.textContent = 'Analyzing with AI...';
    
    const response = await chrome.runtime.sendMessage({
      type: 'PARSE_CV',
      cvText
    });
    
    dropZone.classList.remove('loading');
    dropZone.classList.add('success');
    fileName.textContent = '✓ ' + file.name;
    
    if (response?.profile) {
      showStatus('Profile ready!', 'success');
      showProfile(response.profile);
    } else {
      showStatus(response?.error || 'Failed to parse CV', 'error');
    }
  } catch (err) {
    dropZone.classList.remove('loading');
    fileName.classList.add('hidden');
    showStatus('Error: ' + err.message, 'error');
  }
}

// Extract text from PDF
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  
  return text.trim();
}

function showStatus(msg, type) {
  status.textContent = msg;
  status.className = `status ${type}`;
  setTimeout(() => status.classList.add('hidden'), 3000);
}

function showProfile(profile) {
  profileSection.classList.remove('hidden');
  profileDisplay.innerHTML = `
    <div class="label">Name</div>
    <div class="value">${profile.name || 'Unknown'}</div>
    
    <div class="label">Title</div>
    <div class="value">${profile.title || 'Unknown'}</div>
    
    <div class="label">Experience</div>
    <div class="value">${profile.years_experience || 0} years</div>
    
    <div class="label">Skills</div>
    <div class="skills">
      ${(profile.skills || []).map(s => `<span class="skill">${s}</span>`).join('')}
    </div>
  `;
}
