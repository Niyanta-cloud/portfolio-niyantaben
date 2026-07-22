const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// --- Locales ---
const locales = {};
function loadLocales() {
  const dir = path.join(__dirname, 'locales');
  fs.readdirSync(dir).forEach(f => {
    if (f.endsWith('.json')) {
      const lang = f.replace('.json', '');
      locales[lang] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    }
  });
}
loadLocales();

const SUPPORTED_LANGS = Object.keys(locales);
const DEFAULT_LANG = 'en';

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'portfolio-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// --- Multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = path.join(__dirname, 'public', 'uploads');
    if (file.fieldname === 'file') dir = path.join(dir, 'certificates');
    else if (file.fieldname === 'screenshot') dir = path.join(dir, 'projects');
    else if (file.fieldname === 'photo') dir = path.join(__dirname, 'public', 'images');
    else if (file.fieldname === 'resume') dir = path.join(dir, 'resume');
    else if (file.fieldname === 'attachment') dir = path.join(dir, 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --- i18n Helper ---
app.use((req, res, next) => {
  const acceptLang = req.headers['accept-language'] || '';
  const queryLang = req.query.lang;
  const sessionLang = req.session.lang;

  let lang = queryLang || sessionLang || acceptLang.split(',')[0].split('-')[0] || DEFAULT_LANG;
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  req.lang = lang;
  req.session.lang = lang;

  const t = (key) => {
    const data = locales[lang] || locales[DEFAULT_LANG];
    return data[key] || locales[DEFAULT_LANG][key] || key;
  };
  res.locals.t = t;
  res.locals.lang = lang;
  res.locals.locales = locales;
  // content helper: picks language variant of a field
  res.locals.l = (item, field) => {
    if (!item) return '';
    const deField = field + 'De';
    return lang === 'de' && item[deField] ? item[deField] : item[field] || '';
  };
  next();
});

// --- Data Injection ---
app.use((req, res, next) => {
  res.locals.profile = db.getProfile();
  res.locals.education = db.getEducation();
  res.locals.experience = db.getExperience();
  res.locals.certifications = db.getCertifications();
  res.locals.projects = db.getProjects();
  res.locals.skills = db.getSkills();
  res.locals.softSkills = db.getSoftSkills();
  res.locals.faq = db.getFAQ();
  res.locals.languages = db.getLanguages();
  res.locals.settings = db.getSettings();
  res.locals.about = db.getAbout();

  const s = db.getSettings();
  res.locals.resumeEn = s.resumeEn || s.resumeFile || '';
  res.locals.resumeDe = s.resumeDe || s.resumeFile || '';
  next();
});

// --- Routes: Public ---
app.get('/', (req, res) => {
  res.render('index');
});

// --- Contact Form ---
app.post('/contact', upload.single('attachment'), (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.json({ success: false, message: res.locals.t('contact_error') });
  }
  const attachment = req.file ? '/uploads/attachments/' + req.file.filename : '';
  db.addMessage({ name, email, subject, message, attachment });
  // Send email notification
  try {
    const settings = db.getSettings();
    if (settings.smtpHost && settings.smtpUser && settings.smtpPass && settings.email) {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        secure: false,
        auth: { user: settings.smtpUser, pass: settings.smtpPass }
      });
      const mailOptions = {
        from: settings.smtpUser,
        to: settings.email,
        subject: `Portfolio Message: ${subject}`,
        html: `<h3>New message from your portfolio</h3>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Subject:</strong> ${subject}</p>
<p><strong>Message:</strong></p>
<p>${message}</p>`
      };
      if (req.file) {
        mailOptions.attachments = [{
          filename: req.file.originalname,
          path: req.file.path
        }];
      }
      transporter.sendMail(mailOptions).catch(() => {});
    }
  } catch {}
  res.json({ success: true, message: res.locals.t('contact_success') });
});

// --- Routes: Admin Auth ---
app.get('/admin/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: '' });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const settings = db.getSettings();
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (username === 'admin' && hash === settings.adminPassword) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid credentials' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// --- Admin Dashboard ---
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin/dashboard', {
    educationCount: db.getEducation().length,
    certCount: db.getCertifications().length,
    expCount: db.getExperience().length,
    projectCount: db.getProjects().length,
    faqCount: db.getFAQ().length,
    msgCount: db.getMessages().length
  });
});

// --- Admin: Certifications ---
app.get('/admin/certifications', requireAdmin, (req, res) => {
  res.render('admin/certifications', { items: db.getCertifications() });
});

app.get('/admin/certifications/add', requireAdmin, (req, res) => {
  res.render('admin/cert-form', { item: null, isEdit: false });
});

app.post('/admin/certifications/add', requireAdmin, upload.single('file'), (req, res) => {
  const { title, organization, issueDate } = req.body;
  const file = req.file ? '/uploads/certificates/' + req.file.filename : '';
  db.addCertification({ title, organization, issueDate, file });
  res.redirect('/admin/certifications');
});

app.get('/admin/certifications/edit/:id', requireAdmin, (req, res) => {
  const item = db.getCertifications().find(c => c.id === req.params.id);
  if (!item) return res.redirect('/admin/certifications');
  res.render('admin/cert-form', { item, isEdit: true });
});

app.post('/admin/certifications/edit/:id', requireAdmin, upload.single('file'), (req, res) => {
  const { title, organization, issueDate } = req.body;
  const data = { title, organization, issueDate };
  if (req.file) data.file = '/uploads/certificates/' + req.file.filename;
  db.updateCertification(req.params.id, data);
  res.redirect('/admin/certifications');
});

app.post('/admin/certifications/delete/:id', requireAdmin, (req, res) => {
  db.deleteCertification(req.params.id);
  res.redirect('/admin/certifications');
});

// --- Admin: Projects ---
app.get('/admin/projects', requireAdmin, (req, res) => {
  res.render('admin/projects', { items: db.getProjects() });
});

app.get('/admin/projects/add', requireAdmin, (req, res) => {
  res.render('admin/project-form', { item: null, isEdit: false });
});

app.post('/admin/projects/add', requireAdmin, upload.single('screenshot'), (req, res) => {
  const { name, description, technologies, github, demo } = req.body;
  const techArr = technologies ? technologies.split(',').map(t => t.trim()) : [];
  const screenshot = req.file ? '/uploads/projects/' + req.file.filename : '';
  db.addProject({ name, description, technologies: techArr, github, demo, screenshot });
  res.redirect('/admin/projects');
});

app.get('/admin/projects/edit/:id', requireAdmin, (req, res) => {
  const item = db.getProjects().find(p => p.id === req.params.id);
  if (!item) return res.redirect('/admin/projects');
  res.render('admin/project-form', { item, isEdit: true });
});

app.post('/admin/projects/edit/:id', requireAdmin, upload.single('screenshot'), (req, res) => {
  const { name, description, technologies, github, demo } = req.body;
  const data = {
    name, description,
    technologies: technologies ? technologies.split(',').map(t => t.trim()) : [],
    github, demo
  };
  if (req.file) data.screenshot = '/uploads/projects/' + req.file.filename;
  db.updateProject(req.params.id, data);
  res.redirect('/admin/projects');
});

app.post('/admin/projects/delete/:id', requireAdmin, (req, res) => {
  db.deleteProject(req.params.id);
  res.redirect('/admin/projects');
});

// --- Admin: Experience ---
app.get('/admin/experience', requireAdmin, (req, res) => {
  res.render('admin/experience', { items: db.getExperience() });
});

app.get('/admin/experience/add', requireAdmin, (req, res) => {
  res.render('admin/exp-form', { item: null, isEdit: false });
});

app.post('/admin/experience/add', requireAdmin, (req, res) => {
  const { company, position, period, responsibilities } = req.body;
  db.addExperience({ company, position, period, responsibilities });
  res.redirect('/admin/experience');
});

app.get('/admin/experience/edit/:id', requireAdmin, (req, res) => {
  const item = db.getExperience().find(e => e.id === req.params.id);
  if (!item) return res.redirect('/admin/experience');
  res.render('admin/exp-form', { item, isEdit: true });
});

app.post('/admin/experience/edit/:id', requireAdmin, (req, res) => {
  const { company, position, period, responsibilities } = req.body;
  db.updateExperience(req.params.id, { company, position, period, responsibilities });
  res.redirect('/admin/experience');
});

app.post('/admin/experience/delete/:id', requireAdmin, (req, res) => {
  db.deleteExperience(req.params.id);
  res.redirect('/admin/experience');
});

// --- Admin: Education ---
app.get('/admin/education', requireAdmin, (req, res) => {
  res.render('admin/education', { items: db.getEducation() });
});

app.get('/admin/education/add', requireAdmin, (req, res) => {
  res.render('admin/edu-form', { item: null, isEdit: false });
});

app.post('/admin/education/add', requireAdmin, (req, res) => {
  const { degree, institution, period, detailKey } = req.body;
  db.addEducation({ degree, institution, period, detailKey });
  res.redirect('/admin/education');
});

app.get('/admin/education/edit/:id', requireAdmin, (req, res) => {
  const item = db.getEducation().find(e => e.id === req.params.id);
  if (!item) return res.redirect('/admin/education');
  res.render('admin/edu-form', { item, isEdit: true });
});

app.post('/admin/education/edit/:id', requireAdmin, (req, res) => {
  const { degree, institution, period, detailKey } = req.body;
  db.updateEducation(req.params.id, { degree, institution, period, detailKey });
  res.redirect('/admin/education');
});

app.post('/admin/education/delete/:id', requireAdmin, (req, res) => {
  db.deleteEducation(req.params.id);
  res.redirect('/admin/education');
});

// --- Admin: Skills ---
app.get('/admin/skills', requireAdmin, (req, res) => {
  res.render('admin/skills', { items: db.getSkills(), softItems: db.getSoftSkills() });
});

app.post('/admin/skills', requireAdmin, (req, res) => {
  const skills = req.body.skills.split('\n').filter(s => s.trim()).map(s => s.trim());
  db.saveSkills(skills);
  res.redirect('/admin/skills');
});

app.post('/admin/soft-skills', requireAdmin, (req, res) => {
  const skills = req.body.skills.split('\n').filter(s => s.trim()).map(s => s.trim());
  db.saveSoftSkills(skills);
  res.redirect('/admin/skills');
});

// --- Admin: FAQ ---
app.get('/admin/faq', requireAdmin, (req, res) => {
  res.render('admin/faq', { items: db.getFAQ() });
});

app.get('/admin/faq/add', requireAdmin, (req, res) => {
  res.render('admin/faq-form', { item: null, isEdit: false });
});

app.post('/admin/faq/add', requireAdmin, (req, res) => {
  const { questionKey, answerKey } = req.body;
  db.addFAQ({ questionKey, answerKey });
  res.redirect('/admin/faq');
});

app.get('/admin/faq/edit/:id', requireAdmin, (req, res) => {
  const item = db.getFAQ().find(f => f.id === req.params.id);
  if (!item) return res.redirect('/admin/faq');
  res.render('admin/faq-form', { item, isEdit: true });
});

app.post('/admin/faq/edit/:id', requireAdmin, (req, res) => {
  const { questionKey, answerKey } = req.body;
  db.updateFAQ(req.params.id, { questionKey, answerKey });
  res.redirect('/admin/faq');
});

app.post('/admin/faq/delete/:id', requireAdmin, (req, res) => {
  db.deleteFAQ(req.params.id);
  res.redirect('/admin/faq');
});

// --- Admin: Profile ---
app.get('/admin/profile', requireAdmin, (req, res) => {
  res.render('admin/profile', { profile: db.getProfile() });
});

app.post('/admin/profile', requireAdmin, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'heroImage', maxCount: 1 }]), (req, res) => {
  const { name, title, subtitle, subtitleDe, desc, descDe, tagline, taglineDe, tech, intro } = req.body;
  const data = { name, title, subtitle, subtitleDe, desc, descDe, tagline, taglineDe, tech, intro };
  if (req.files) {
    if (req.files.photo) data.photo = '/images/' + req.files.photo[0].filename;
    if (req.files.heroImage) data.heroImage = '/images/' + req.files.heroImage[0].filename;
  }
  // Preserve existing values if not changed
  const current = db.getProfile();
  if (!data.photo) data.photo = current.photo;
  if (!data.heroImage) data.heroImage = current.heroImage || '';
  db.saveProfile(data);
  res.redirect('/admin/profile');
});

// --- Admin: Settings ---
app.get('/admin/settings', requireAdmin, (req, res) => {
  res.render('admin/settings', { settings: db.getSettings() });
});

app.post('/admin/settings', requireAdmin, upload.fields([{ name: 'resumeEn', maxCount: 1 }, { name: 'resumeDe', maxCount: 1 }]), (req, res) => {
  const { email, phone, location, github, linkedin, twitter, password, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;
  const current = db.getSettings();
  const data = {
    email: email || current.email,
    phone: phone || current.phone,
    location: location || current.location,
    social: {
      github: github || (current.social || {}).github,
      linkedin: linkedin || (current.social || {}).linkedin,
      twitter: twitter || (current.social || {}).twitter
    },
    adminPassword: current.adminPassword,
    resumeEn: current.resumeEn,
    resumeDe: current.resumeDe,
    smtpHost: smtpHost || current.smtpHost || '',
    smtpPort: parseInt(smtpPort) || current.smtpPort || 587,
    smtpUser: smtpUser || current.smtpUser || '',
    smtpPass: smtpPass || current.smtpPass || ''
  };
  if (password) {
    data.adminPassword = crypto.createHash('sha256').update(password).digest('hex');
  }
  if (req.files && req.files.resumeEn) data.resumeEn = '/uploads/resume/' + req.files.resumeEn[0].filename;
  if (req.files && req.files.resumeDe) data.resumeDe = '/uploads/resume/' + req.files.resumeDe[0].filename;
  db.saveSettings(data);
  res.redirect('/admin/settings');
});

// --- Admin: Messages ---
app.get('/admin/messages', requireAdmin, (req, res) => {
  res.render('admin/messages', { items: db.getMessages() });
});

app.post('/admin/messages/delete/:id', requireAdmin, (req, res) => {
  db.deleteMessage(req.params.id);
  res.redirect('/admin/messages');
});

// --- Admin: Translations ---
app.get('/admin/translations', requireAdmin, (req, res) => {
  res.render('admin/translations', { locales });
});

app.post('/admin/translations', requireAdmin, (req, res) => {
  const { lang, content } = req.body;
  try {
    const parsed = JSON.parse(content);
    const filePath = path.join(__dirname, 'locales', lang + '.json');
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
    loadLocales();
  } catch (e) {
    // invalid JSON
  }
  res.redirect('/admin/translations');
});

// --- Admin About ---
app.get('/admin/about', requireAdmin, (req, res) => {
  res.render('admin/about', { about: db.getAbout() });
});

app.post('/admin/about', requireAdmin, (req, res) => {
  const { intro, outro } = req.body;
  const highlights = [];
  const titles = Array.isArray(req.body['highlightTitle']) ? req.body['highlightTitle'] : [];
  const texts = Array.isArray(req.body['highlightText']) ? req.body['highlightText'] : [];
  const icons = ['cloud', 'briefcase', 'code', 'language'];
  for (let i = 0; i < 4; i++) {
    if (titles[i] && texts[i]) {
      highlights.push({ icon: icons[i] || 'circle', title: titles[i], text: texts[i] });
    }
  }
  db.saveAbout({ intro, highlights, outro });
  res.redirect('/admin/about');
});

// --- View Engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- 404 ---
app.use((req, res) => {
  res.status(404).send('404 - Not Found');
});

// --- Start ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Portfolio server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
    console.log(`Admin credentials: admin / 123prashant`);
  });
}

module.exports = app;
