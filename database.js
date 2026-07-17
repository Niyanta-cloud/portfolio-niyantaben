const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  profile: path.join(DATA_DIR, 'profile.json'),
  about: path.join(DATA_DIR, 'about.json'),
  education: path.join(DATA_DIR, 'education.json'),
  experience: path.join(DATA_DIR, 'experience.json'),
  certifications: path.join(DATA_DIR, 'certifications.json'),
  projects: path.join(DATA_DIR, 'projects.json'),
  skills: path.join(DATA_DIR, 'skills.json'),
  softskills: path.join(DATA_DIR, 'softskills.json'),
  faq: path.join(DATA_DIR, 'faq.json'),
  languages: path.join(DATA_DIR, 'languages.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  translations: path.join(DATA_DIR, 'translations.json'),
  settings: path.join(DATA_DIR, 'settings.json')
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function read(key) {
  const p = FILES[key];
  if (!p) return null;
  if (!fs.existsSync(p)) return key === 'settings' ? {} : [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return key === 'settings' ? {} : [];
  }
}

function write(key, data) {
  const p = FILES[key];
  if (!p) return false;
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

const db = {
  // Profile
  getProfile: () => read('profile') || { name: '', title: '', tagline: '', intro: '', photo: '' },
  saveProfile: (data) => write('profile', data),

  // Education
  getEducation: () => read('education'),
  addEducation: (item) => { const d = read('education'); d.push({ id: Date.now().toString(), ...item }); write('education', d); return d; },
  updateEducation: (id, item) => { const d = read('education'); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...item }; write('education', d); } return d; },
  deleteEducation: (id) => { const d = read('education').filter(x => x.id !== id); write('education', d); return d; },

  // Experience
  getExperience: () => read('experience'),
  addExperience: (item) => { const d = read('experience'); d.push({ id: Date.now().toString(), ...item }); write('experience', d); return d; },
  updateExperience: (id, item) => { const d = read('experience'); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...item }; write('experience', d); } return d; },
  deleteExperience: (id) => { const d = read('experience').filter(x => x.id !== id); write('experience', d); return d; },

  // Certifications
  getCertifications: () => read('certifications'),
  addCertification: (item) => { const d = read('certifications'); d.push({ id: Date.now().toString(), ...item }); write('certifications', d); return d; },
  updateCertification: (id, item) => { const d = read('certifications'); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...item }; write('certifications', d); } return d; },
  deleteCertification: (id) => { const d = read('certifications').filter(x => x.id !== id); write('certifications', d); return d; },

  // Projects
  getProjects: () => read('projects'),
  addProject: (item) => { const d = read('projects'); d.push({ id: Date.now().toString(), ...item }); write('projects', d); return d; },
  updateProject: (id, item) => { const d = read('projects'); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...item }; write('projects', d); } return d; },
  deleteProject: (id) => { const d = read('projects').filter(x => x.id !== id); write('projects', d); return d; },

  // Skills
  getSkills: () => read('skills'),
  getSoftSkills: () => read('softskills'),
  saveSkills: (items) => write('skills', items),
  saveSoftSkills: (items) => write('softskills', items),

  // FAQ
  getFAQ: () => read('faq'),
  addFAQ: (item) => { const d = read('faq'); d.push({ id: Date.now().toString(), ...item }); write('faq', d); return d; },
  updateFAQ: (id, item) => { const d = read('faq'); const i = d.findIndex(x => x.id === id); if (i > -1) { d[i] = { ...d[i], ...item }; write('faq', d); } return d; },
  deleteFAQ: (id) => { const d = read('faq').filter(x => x.id !== id); write('faq', d); return d; },

  // Languages
  getLanguages: () => read('languages'),
  saveLanguages: (items) => write('languages', items),

  // Messages
  getMessages: () => read('messages'),
  addMessage: (item) => { const d = read('messages'); d.push({ id: Date.now().toString(), date: new Date().toISOString(), ...item }); write('messages', d); return d; },
  deleteMessage: (id) => { const d = read('messages').filter(x => x.id !== id); write('messages', d); return d; },

  // Settings (admin password, etc.)
  getSettings: () => read('settings'),
  saveSettings: (data) => write('settings', data),

  // Translations
  getTranslations: () => read('translations'),
  saveTranslation: (lang, data) => { const d = read('translations'); d[lang] = data; write('translations', d); return d; },
  getTranslation: (lang) => { const d = read('translations'); return d[lang] || null; },

  // About
  getAbout: () => read('about') || { intro: '', highlights: [], outro: '' },
  saveAbout: (data) => write('about', data)
};

module.exports = db;
