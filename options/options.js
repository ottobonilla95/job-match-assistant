// Options page - PDF upload only

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileName = document.getElementById('file-name');
const status = document.getElementById('status');
const uploadSection = document.getElementById('upload-section');
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
  
  // Hide entire upload section, show analyzing status
  uploadSection.classList.add('hidden');
  showStatus('📄 Reading PDF...', 'loading', true);
  
  try {
    // Extract text from PDF
    cvText = await extractPdfText(file);
    await chrome.storage.sync.set({ cvText });
    
    // Auto-parse with AI
    showStatus('✨ Analyzing with AI...', 'loading', true);
    
    const response = await chrome.runtime.sendMessage({
      type: 'PARSE_CV',
      cvText
    });
    
    // Show upload section again
    uploadSection.classList.remove('hidden');
    
    if (response?.profile) {
      dropZone.classList.add('success');
      fileName.textContent = '✓ ' + file.name;
      fileName.classList.remove('hidden');
      showStatus('Profile ready!', 'success');
      showProfile(response.profile);
    } else {
      // Not a valid CV - reset state and hide profile
      dropZone.classList.remove('success');
      fileName.classList.add('hidden');
      profileSection.classList.add('hidden');
      showStatus(response?.error || 'Failed to parse CV', 'error', true);
    }
  } catch (err) {
    uploadSection.classList.remove('hidden');
    dropZone.classList.remove('success');
    fileName.classList.add('hidden');
    profileSection.classList.add('hidden');
    showStatus('Error: ' + err.message, 'error', true);
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

function showStatus(msg, type, persistent = false) {
  status.textContent = msg;
  status.className = `status ${type}`;
  // Errors stay visible, success messages fade after 3s
  if (!persistent && type === 'success') {
    setTimeout(() => status.classList.add('hidden'), 3000);
  }
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
  
  // Show next steps
  showNextSteps();
}

function showNextSteps() {
  let nextSteps = document.getElementById('next-steps');
  if (!nextSteps) {
    nextSteps = document.createElement('div');
    nextSteps.id = 'next-steps';
    nextSteps.className = 'card next-steps';
    document.querySelector('.app').appendChild(nextSteps);
  }
  
  nextSteps.innerHTML = `
    <h2>🚀 Ready to go!</h2>
    <div class="steps">
      <div class="step">
        <span class="step-num">1</span>
        <span>Go to any job posting (LinkedIn, Indeed, company careers page...)</span>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        <span>Click the <strong>✨</strong> button that appears</span>
      </div>
      <div class="step">
        <span class="step-num">3</span>
        <span>Get instant match analysis & cover letter</span>
      </div>
    </div>
    <p class="tip">💡 <strong>Tip:</strong> On non-supported sites, click the extension icon → "Analyze This Page"</p>
  `;
}
