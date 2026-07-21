document.addEventListener('DOMContentLoaded', function() {

  // Theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    themeBtn.addEventListener('click', function() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? '' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next || 'light');
    });
  }

  // Mobile nav toggle
  const toggleBtn = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', function() {
      navLinks.classList.toggle('show');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('show'));
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-question');
    if (q) {
      q.addEventListener('click', function() {
        item.classList.toggle('active');
      });
    }
  });

  // Cert preview modal
  const modal = document.getElementById('certModal');
  const modalImg = document.getElementById('certModalImg');
  if (modal && modalImg) {
    document.querySelectorAll('.cert-preview, .cert-no-img').forEach(el => {
      el.addEventListener('click', function() {
        const src = this.getAttribute('data-src') || this.src;
        if (src) {
          modalImg.src = src;
          modal.classList.add('show');
        }
      });
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('show');
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') modal.classList.remove('show');
    });
  }

  // Contact form
  const form = document.getElementById('contactForm');
  if (form) {
    // Show selected file name
    const fileInput = document.getElementById('attachment');
    const fileNameSpan = document.getElementById('fileName');
    if (fileInput && fileNameSpan) {
      fileInput.addEventListener('change', function() {
        if (this.files[0]) {
          if (this.files[0].size > 10 * 1024 * 1024) {
            fileNameSpan.textContent = 'File too large (max 10MB)';
            fileNameSpan.style.color = '#dc2626';
            this.value = '';
          } else {
            fileNameSpan.textContent = 'Selected: ' + this.files[0].name;
            fileNameSpan.style.color = '';
          }
        } else {
          fileNameSpan.textContent = '';
        }
      });
    }
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const msg = document.getElementById('formMsg');
      // Client-side validation
      if (!form.subject.value.trim()) {
        msg.className = 'form-msg error';
        msg.textContent = 'Subject is required.';
        form.subject.focus();
        setTimeout(() => { msg.className = 'form-msg'; }, 4000);
        return;
      }
      if (!form.name.value.trim()) {
        msg.className = 'form-msg error';
        msg.textContent = 'Name is required.';
        form.name.focus();
        setTimeout(() => { msg.className = 'form-msg'; }, 4000);
        return;
      }
      if (!form.email.value.trim()) {
        msg.className = 'form-msg error';
        msg.textContent = 'Email is required.';
        form.email.focus();
        setTimeout(() => { msg.className = 'form-msg'; }, 4000);
        return;
      }
      if (!form.message.value.trim()) {
        msg.className = 'form-msg error';
        msg.textContent = 'Message is required.';
        form.message.focus();
        setTimeout(() => { msg.className = 'form-msg'; }, 4000);
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      try {
        const fd = new FormData(form);
        const res = await fetch(form.action, {
          method: 'POST',
          body: fd
        });
        const data = await res.json();
        if (data.success) {
          msg.className = 'form-msg success';
          msg.textContent = data.message || 'Message sent!';
          form.reset();
          if (fileNameSpan) fileNameSpan.textContent = '';
        } else {
          msg.className = 'form-msg error';
          msg.textContent = data.message || 'Failed to send.';
        }
      } catch {
        msg.className = 'form-msg error';
        msg.textContent = 'Network error. Please try again.';
      }
      btn.disabled = false;
      btn.textContent = 'Send Message';
      setTimeout(() => { msg.className = 'form-msg'; }, 5000);
    });
  }
});
