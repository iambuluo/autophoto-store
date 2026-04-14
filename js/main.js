// AutoPhoto 展示网站 JavaScript
// 简单交互逻辑，无需框架

// 导航高亮
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav-links a');
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
});

// 平滑回到顶部（如果有按钮的话）
window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
