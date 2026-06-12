/* COVERA — interaccions mínimes */
(function() {
  'use strict';

  // Idioma — emmagatzema preferència
  const langLinks = document.querySelectorAll('[data-lang]');
  langLinks.forEach(a => {
    a.addEventListener('click', e => {
      const lang = a.dataset.lang;
      try { localStorage.setItem('covera-lang', lang); } catch(e) {}
    });
  });

  // Hashtags amb tooltip discret (per ara: no action, però marca preparada)
  document.querySelectorAll('.hashtags a').forEach(tag => {
    tag.title = 'Producte assegurador · pendent fitxa';
  });

  // Formulari de diagnòstic — validació mínima
  const form = document.querySelector('form[data-form="diagnostic"]');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const consent = form.querySelector('input[name="consent"]');
      if (!consent || !consent.checked) {
        alert("Cal acceptar la política de privacitat per continuar.");
        return;
      }
      const success = document.querySelector('[data-form-success]');
      if (success) {
        form.style.display = 'none';
        success.style.display = 'block';
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Reveal en scroll (per a pàgines llargues)
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('reveal');
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
  }
})();
