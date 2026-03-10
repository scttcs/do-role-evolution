const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readVersions() {
  try {
    return JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeVersions(versions) {
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2));
}

// GET /api/versions — return all versions
app.get('/api/versions', (req, res) => {
  res.json(readVersions());
});

// POST /api/versions — append a new version (server assigns id + timestamp)
app.post('/api/versions', (req, res) => {
  const { snapshot, label } = req.body;
  if (!snapshot) return res.status(400).json({ error: 'snapshot required' });

  const versions = readVersions();
  const nextId = versions.length ? versions[versions.length - 1].id + 1 : 1;
  const version = {
    id: nextId,
    timestamp: new Date().toISOString(),
    label: label || `Version ${nextId}`,
    snapshot
  };

  versions.push(version);
  writeVersions(versions);
  res.status(201).json(version);
});

// DELETE /api/versions — clear all versions
app.delete('/api/versions', (req, res) => {
  writeVersions([]);
  res.json({ ok: true });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
