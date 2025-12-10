# Job Match

Simple Chrome extension: upload your CV, get instant job match insights.

## How It Works

1. **Upload your CV (PDF)** → AI extracts your skills & experience
2. **Browse jobs** on LinkedIn, Indeed, Greenhouse, Lever
3. **Click the ✓ button** → See match analysis

## What You Get

- **Job title & role** (Frontend, Backend, Fullstack, etc.)
- **Level & location** (Senior, Remote, Berlin, etc.)
- **Required skills** (React, Node.js, Python...) with matches highlighted
- **Match %** based on your profile
- **Salary estimate** (location-aware, local currency)
- **Analysis** explaining why you match (or don't)
- **Cover letter generator** - short, tailored letter with one click

## Install

1. Clone/download this folder
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select this folder

## Setup

1. Copy `config.example.js` to `config.js`
2. Add your OpenAI API key to `config.js`
3. Load/reload the extension in Chrome
4. Click extension icon → **Settings**
5. Upload your CV (PDF)
6. Wait for AI to parse your profile

Done! Now go to any job listing and click the ✓ button.

> **Note:** `config.js` is gitignored - your API key won't be committed.

## Supported Sites

- LinkedIn Jobs
- Indeed
- Greenhouse
- Lever
- Most job pages (reads full page text)

## Privacy

- Your CV stays in Chrome storage
- API calls go directly to OpenAI
- No tracking, no data collection
