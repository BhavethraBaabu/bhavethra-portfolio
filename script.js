// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    target.scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Theme toggle
const themeToggleBtn = document.createElement('button');
themeToggleBtn.innerText = '🌓 Theme';
themeToggleBtn.classList.add('theme-toggle');
document.querySelector('header').appendChild(themeToggleBtn);

themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem(
    'theme',
    document.body.classList.contains('dark-mode') ? 'dark' : 'light'
  );
});

// Preserve theme on reload
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
}

// Simple fade-in animation for sections
const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.2 });

sections.forEach(section => observer.observe(section));
