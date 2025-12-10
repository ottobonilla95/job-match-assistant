// Content script - extracts job data and shows simple overlay

(function() {
  if (window.__jobMatchLoaded) return;
  window.__jobMatchLoaded = true;

  let widget = null;

  // Create floating button
  let btnElement = null;
  function createButton() {
    const btn = document.createElement('div');
    btn.id = 'job-match-btn';
    btn.innerHTML = '✨';
    btn.title = 'Analyze Job';
    document.body.appendChild(btn);

    btn.addEventListener('click', analyzeJob);
    btnElement = btn;
    return btn;
  }

  // Create results widget
  function createWidget() {
    if (widget) widget.remove();
    
    widget = document.createElement('div');
    widget.id = 'job-match-widget';
    document.body.appendChild(widget);
    return widget;
  }

  // Extract job text from page - simple and direct
  function extractJobText() {
    // Just get all visible text from the page
    const text = document.body.innerText;
    console.log('Job Match - Extracted text length:', text.length);
    console.log('Job Match - First 500 chars:', text.substring(0, 500));
    return text.substring(0, 12000);
  }

  // Analyze job
  async function analyzeJob() {
    // Show loading in button
    btnElement.classList.add('loading');
    btnElement.innerHTML = '<div class="jm-btn-spinner"></div>';

    try {
      // Check if ready
      const ready = await chrome.runtime.sendMessage({ type: 'CHECK_READY' });
      
      // Handle case where background didn't respond
      if (!ready) {
        btnElement.classList.remove('loading');
        btnElement.innerHTML = '✨';
        const w = createWidget();
        w.innerHTML = '<div class="jm-header"><div class="jm-close" onclick="this.closest(\'#job-match-widget\').remove()">×</div></div><div class="jm-content"><div class="jm-error">❌ Extension not ready<br><small>Try reloading the page</small></div></div>';
        return;
      }
      
      if (!ready.hasApiKey) {
        btnElement.classList.remove('loading');
        btnElement.innerHTML = '✨';
        const w = createWidget();
        w.innerHTML = '<div class="jm-header"><div class="jm-close" onclick="this.closest(\'#job-match-widget\').remove()">×</div></div><div class="jm-content"><div class="jm-error">❌ No API key<br><small>Copy config.example.js → config.js<br>and add your OpenAI key</small></div></div>';
        return;
      }
      
      if (!ready.hasProfile) {
        btnElement.classList.remove('loading');
        btnElement.innerHTML = '✨';
        const w = createWidget();
        w.innerHTML = `<div class="jm-header"><div class="jm-close" id="jm-close-error">×</div></div><div class="jm-content"><div class="jm-error">❌ No CV uploaded<br><small>Add your CV first</small></div><button class="jm-settings-btn" id="jm-open-settings">⚙️ Open Settings</button></div>`;
        w.querySelector('#jm-close-error').addEventListener('click', () => w.remove());
        w.querySelector('#jm-open-settings').addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
          w.remove();
        });
        return;
      }

      const jobText = extractJobText();
      
      if (!jobText || jobText.length < 100) {
        btnElement.classList.remove('loading');
        btnElement.innerHTML = '✨';
        const w = createWidget();
        w.innerHTML = '<div class="jm-header"><div class="jm-close" onclick="this.closest(\'#job-match-widget\').remove()">×</div></div><div class="jm-content"><div class="jm-error">❌ Could not find job description</div></div>';
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_JOB',
        jobText
      });

      // Reset button
      btnElement.classList.remove('loading');
      btnElement.innerHTML = '✨';

      if (response.error) {
        const w = createWidget();
        w.innerHTML = `<div class="jm-header"><div class="jm-close" onclick="this.closest('#job-match-widget').remove()">×</div></div><div class="jm-content"><div class="jm-error">❌ ${response.error}</div></div>`;
        return;
      }

      // Only show widget when we have results
      const w = createWidget();
      showResults(response.analysis);

    } catch (err) {
      btnElement.classList.remove('loading');
      btnElement.innerHTML = '✨';
      const w = createWidget();
      w.innerHTML = `<div class="jm-header"><div class="jm-close" onclick="this.closest('#job-match-widget').remove()">×</div></div><div class="jm-content"><div class="jm-error">❌ ${err.message}</div></div>`;
    }
  }

  // Store current job data for cover letter
  let currentJobData = null;

  // Show results
  function showResults(data) {
    currentJobData = data;
    const matchColor = data.match_percent >= 70 ? '#22c55e' : 
                       data.match_percent >= 50 ? '#eab308' : '#ef4444';
    
    const applyColor = data.should_apply ? '#22c55e' : '#ef4444';
    const applyText = data.should_apply ? 'Yes' : 'No';

    widget.innerHTML = `
      <div class="jm-header">
        <div class="jm-close" id="jm-close-btn">×</div>
      </div>
      <div class="jm-content">
        <div class="jm-title">${data.title}</div>
        
        <div class="jm-info-grid">
          <div class="jm-info">
            <span class="jm-info-label">Role</span>
            <span class="jm-info-value">${data.role}</span>
          </div>
          <div class="jm-info">
            <span class="jm-info-label">Level</span>
            <span class="jm-info-value">${data.seniority}</span>
          </div>
          <div class="jm-info">
            <span class="jm-info-label">Location</span>
            <span class="jm-info-value">${data.location || 'Not specified'}</span>
          </div>
          <div class="jm-info">
            <span class="jm-info-label">Work</span>
            <span class="jm-info-value">${data.work_mode}</span>
          </div>
          <div class="jm-info">
            <span class="jm-info-label">Experience</span>
            <span class="jm-info-value">${data.required_years > 0 ? data.required_years + '+ years' : 'Not specified'}</span>
          </div>
        </div>
        
        <div class="jm-section">
          <div class="jm-section-label">Job Requires</div>
          <div class="jm-keywords">
            ${(data.required_skills || []).map(skill => {
              const isMatch = (data.matching_skills || []).some(m => m.toLowerCase() === skill.toLowerCase());
              return `<span class="jm-tag ${isMatch ? 'jm-tag-match' : ''}">${skill}</span>`;
            }).join('')}
          </div>
        </div>
        
        <div class="jm-section">
          <div class="jm-section-label">Salary</div>
          <div class="jm-salary-row">
            <div class="jm-salary-item">
              <span class="jm-salary-label">Offered:</span>
              <span class="jm-salary-value jm-salary-offered">${data.offered_salary}</span>
            </div>
            <div class="jm-salary-item">
              <span class="jm-salary-label">Ask for:</span>
              <span class="jm-salary-value jm-salary-suggested">${data.suggested_salary}</span>
            </div>
          </div>
        </div>
        
        <div class="jm-row">
          <div class="jm-cell">
            <div class="jm-label">Match</div>
            <div class="jm-value" style="color: ${matchColor}">${data.match_percent}%</div>
          </div>
          <div class="jm-cell">
            <div class="jm-label">Apply?</div>
            <div class="jm-value" style="color: ${applyColor}">${applyText}</div>
          </div>
        </div>
        
        <div class="jm-reason">${data.analysis || data.apply_reason}</div>
        
        <button class="jm-cover-btn" id="jm-cover-btn">✉️ Generate Cover Letter</button>
        <div class="jm-cover-letter" id="jm-cover-letter"></div>
      </div>
    `;
    
    // Add close button listener
    widget.querySelector('#jm-close-btn').addEventListener('click', () => widget.remove());
    
    // Add cover letter button listener
    widget.querySelector('#jm-cover-btn').addEventListener('click', generateCoverLetter);
  }

  // Generate cover letter
  async function generateCoverLetter() {
    const btn = widget.querySelector('#jm-cover-btn');
    const container = widget.querySelector('#jm-cover-letter');
    
    btn.disabled = true;
    btn.innerHTML = '⏳ Generating...';
    
    try {
      const jobText = extractJobText();
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COVER_LETTER',
        jobText,
        jobTitle: currentJobData.title
      });
      
      if (response.error) {
        container.innerHTML = `<div class="jm-error">❌ ${response.error}</div>`;
        btn.innerHTML = '✉️ Generate Cover Letter';
        btn.disabled = false;
        return;
      }
      
      container.innerHTML = `
        <div class="jm-cover-text">${response.coverLetter.replace(/\n/g, '<br>')}</div>
        <button class="jm-copy-btn" id="jm-copy-btn">📋 Copy</button>
      `;
      
      btn.style.display = 'none';
      
      // Copy button
      container.querySelector('#jm-copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(response.coverLetter);
        const copyBtn = container.querySelector('#jm-copy-btn');
        copyBtn.innerHTML = '✓ Copied!';
        setTimeout(() => copyBtn.innerHTML = '📋 Copy', 2000);
      });
      
    } catch (err) {
      container.innerHTML = `<div class="jm-error">❌ ${err.message}</div>`;
      btn.innerHTML = '✉️ Generate Cover Letter';
      btn.disabled = false;
    }
  }

  // Init
  createButton();

})();
