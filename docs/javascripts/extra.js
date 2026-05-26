// 自定义 JavaScript

const topNavState = {
  hoverOpen: false,
  initialized: false
};

function updateTopNavCollapse() {
  const shouldCollapse = window.scrollY > 96 && !topNavState.hoverOpen;
  document.body.classList.toggle('top-nav-collapsed', shouldCollapse);
  document.body.classList.toggle('top-nav-hover-open', topNavState.hoverOpen);
}

function setTopNavHoverOpen(open) {
  if (topNavState.hoverOpen === open) {
    return;
  }

  topNavState.hoverOpen = open;
  updateTopNavCollapse();
}

function setupTopNavAutoExpand() {
  if (topNavState.initialized) {
    updateTopNavCollapse();
    return;
  }

  topNavState.initialized = true;

  document.addEventListener('mousemove', function(e) {
    const target = e.target;
    const overTopNav = target.closest && target.closest('.md-header, .md-tabs');

    if (e.clientY <= 96 || overTopNav) {
      setTopNavHoverOpen(true);
      return;
    }

    if (e.clientY > 150) {
      setTopNavHoverOpen(false);
    }
  }, { passive: true });

  document.addEventListener('focusin', function(e) {
    if (e.target.closest && e.target.closest('.md-header, .md-tabs')) {
      setTopNavHoverOpen(true);
    }
  });

  document.addEventListener('focusout', function() {
    window.setTimeout(function() {
      const activeElement = document.activeElement;
      const focusInsideTopNav = activeElement && activeElement.closest && activeElement.closest('.md-header, .md-tabs');
      if (!focusInsideTopNav) {
        setTopNavHoverOpen(false);
      }
    }, 0);
  });

  window.addEventListener('scroll', function() {
    if (window.scrollY <= 96) {
      setTopNavHoverOpen(false);
      return;
    }

    updateTopNavCollapse();
  }, { passive: true });

  updateTopNavCollapse();
}

document.addEventListener('DOMContentLoaded', setupTopNavAutoExpand);

if (typeof document$ !== 'undefined') {
  document$.subscribe(setupTopNavAutoExpand);
}

// 平滑滚动
document.addEventListener('click', function(e) {
  const anchor = e.target.closest('a[href^="#"]');
  if (!anchor) {
    return;
  }

  const href = anchor.getAttribute('href');
  if (!href || href === '#') {
    return;
  }

  let id = href.slice(1);
  if (typeof window.decodeURIComponent === 'function') {
    try {
      id = window.decodeURIComponent(id);
    } catch {
      // Keep the original hash when it is not URI-encoded.
    }
  }

  const target = document.getElementById(id);
  if (!target) {
    return;
  }

  e.preventDefault();
  history.pushState(null, '', href);
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
});

// 代码块复制成功提示
document.addEventListener('DOMContentLoaded', function() {
  const clipboard = document.querySelectorAll('.md-clipboard');
  clipboard.forEach(button => {
    button.addEventListener('click', function() {
      const tooltip = this.querySelector('.md-clipboard__message');
      if (tooltip) {
        tooltip.textContent = '已复制！';
        setTimeout(() => {
          tooltip.textContent = '复制到剪贴板';
        }, 2000);
      }
    });
  });
});

// 阅读进度条
document.addEventListener('DOMContentLoaded', function() {
  const progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 3px;
    background: linear-gradient(90deg, var(--md-primary-fg-color), var(--md-accent-fg-color));
    z-index: 1000;
    transition: width 0.2s ease;
  `;
  document.body.appendChild(progressBar);

  window.addEventListener('scroll', function() {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    const scrolled = window.scrollY;
    const progress = (scrolled / documentHeight) * 100;
    progressBar.style.width = progress + '%';
  });
});

// 外部链接在新标签页打开
document.addEventListener('DOMContentLoaded', function() {
  const links = document.querySelectorAll('a[href^="http"]');
  links.forEach(link => {
    if (!link.hostname.includes(window.location.hostname)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
});

const contentZoomState = {
  initialized: false,
  observedContent: null,
  observer: null
};

function openContentLightbox(content, options = {}) {
  const modal = document.createElement('div');
  modal.className = 'content-lightbox';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const closeButton = document.createElement('button');
  closeButton.className = 'content-lightbox__close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭');
  closeButton.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/>
    </svg>
  `;

  const stage = document.createElement('div');
  stage.className = `content-lightbox__stage ${options.stageClass || ''}`.trim();
  stage.appendChild(content);

  modal.append(closeButton, stage);

  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    document.removeEventListener('keydown', handleKeydown);
    document.body.classList.remove('content-lightbox-open');
    if (typeof options.onClose === 'function') {
      options.onClose();
    }
    modal.remove();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      close();
    }
  };

  modal.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  stage.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  document.addEventListener('keydown', handleKeydown);
  document.body.classList.add('content-lightbox-open');
  document.body.appendChild(modal);
  closeButton.focus();
}

function openImageLightbox(img) {
  const modalImg = new Image();
  modalImg.className = 'content-lightbox__image';
  modalImg.src = img.currentSrc || img.src;
  modalImg.alt = img.alt || '';
  openContentLightbox(modalImg, {
    stageClass: 'content-lightbox__stage--image'
  });
}

function openDiagramLightbox(diagram) {
  if (diagram.closest('.content-lightbox')) {
    return;
  }

  const rect = diagram.getBoundingClientRect();
  const originalStyle = diagram.getAttribute('style');
  const placeholder = document.createComment('content-lightbox-diagram-placeholder');
  const parent = diagram.parentNode;
  parent.insertBefore(placeholder, diagram);

  const availableWidth = window.innerWidth * 0.9;
  const availableHeight = window.innerHeight * 0.76;
  const fitScale = Math.min(
    availableWidth / Math.max(rect.width, 1),
    availableHeight / Math.max(rect.height, 1)
  );
  const scale = Math.min(2, fitScale);
  const diagramFrame = document.createElement('div');
  diagramFrame.className = 'content-lightbox__diagram';
  diagramFrame.style.width = `${Math.ceil(rect.width * scale)}px`;
  diagramFrame.style.height = `${Math.ceil(rect.height * scale)}px`;

  diagram.classList.add('is-zoomed');
  diagram.style.width = `${Math.ceil(rect.width)}px`;
  diagram.style.height = `${Math.ceil(rect.height)}px`;
  diagram.style.setProperty('--course-diagram-scale', scale.toFixed(2));
  diagramFrame.appendChild(diagram);

  openContentLightbox(diagramFrame, {
    stageClass: 'content-lightbox__stage--diagram',
    onClose() {
      diagram.classList.remove('is-zoomed');
      if (originalStyle === null) {
        diagram.removeAttribute('style');
      } else {
        diagram.setAttribute('style', originalStyle);
      }
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(diagram, placeholder);
        placeholder.remove();
      } else if (parent) {
        parent.appendChild(diagram);
      }
    }
  });
}

function enhanceZoomTargets() {
  document.querySelectorAll('.md-content img').forEach(img => {
    img.classList.add('content-zoom-target');
  });

  document.querySelectorAll('.md-content .mermaid').forEach(diagram => {
    if (diagram.closest('.content-lightbox')) {
      return;
    }

    diagram.classList.add('content-zoom-target', 'content-zoom-diagram');
    diagram.setAttribute('role', 'button');
    diagram.setAttribute('tabindex', '0');
    diagram.setAttribute('aria-label', '放大查看图表');
    diagram.setAttribute('title', '放大查看图表');
  });
}

function observeZoomTargets() {
  const content = document.querySelector('.md-content');
  if (!content || contentZoomState.observedContent === content) {
    return;
  }

  if (contentZoomState.observer) {
    contentZoomState.observer.disconnect();
  }

  contentZoomState.observedContent = content;
  contentZoomState.observer = new MutationObserver(function() {
    enhanceZoomTargets();
  });
  contentZoomState.observer.observe(content, {
    childList: true,
    subtree: true
  });
}

function setupContentZoom() {
  observeZoomTargets();
  enhanceZoomTargets();
  window.setTimeout(enhanceZoomTargets, 600);
  window.setTimeout(enhanceZoomTargets, 1800);
  window.setTimeout(enhanceZoomTargets, 3200);

  if (contentZoomState.initialized) {
    return;
  }

  contentZoomState.initialized = true;

  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.target.closest('.content-lightbox')) {
      return;
    }

    const image = e.target.closest('.md-content img');
    if (image) {
      e.preventDefault();
      openImageLightbox(image);
      return;
    }

    const diagram = e.target.closest('.md-content .mermaid');
    if (diagram) {
      e.preventDefault();
      openDiagramLightbox(diagram);
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    const diagram = e.target.closest('.md-content .mermaid');
    if (!diagram) {
      return;
    }

    e.preventDefault();
    openDiagramLightbox(diagram);
  });
}

document.addEventListener('DOMContentLoaded', setupContentZoom);

if (typeof document$ !== 'undefined') {
  document$.subscribe(setupContentZoom);
}

function setupBackToTopButton() {
  const backToTop = document.querySelector('.md-top');
  if (!backToTop || backToTop.dataset.rocketReady === 'true') {
    return;
  }

  backToTop.dataset.rocketReady = 'true';
  backToTop.setAttribute('aria-label', '回到页面顶部');
  backToTop.setAttribute('title', '回到页面顶部');
  backToTop.classList.remove('md-icon');
  backToTop.classList.add('rocket-top');
  backToTop.hidden = false;
  backToTop.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 2.5c2.4 1.7 4 4.5 4 7.7 0 2.6-1 5-2.7 6.7l-.5.5H11.2l-.5-.5A9.6 9.6 0 0 1 8 10.2c0-3.2 1.6-6 4-7.7Zm0 2.5a7.4 7.4 0 0 0-2.2 5.2c0 2 .8 3.9 2.2 5.3a7.5 7.5 0 0 0 2.2-5.3C14.2 8.2 13.4 6.4 12 5Zm0 6.5a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4ZM7.3 14.2c.4.9.9 1.8 1.6 2.6l.4.5-2.4 2.4H4.6l.8-3.1 1.9-2.4Zm9.4 0 1.9 2.4.8 3.1h-2.3l-2.4-2.4.4-.5c.7-.8 1.2-1.7 1.6-2.6ZM12 18.4c.8 0 1.5.7 1.5 1.5 0 1-.9 1.6-1.5 2.1-.6-.5-1.5-1.1-1.5-2.1 0-.8.7-1.5 1.5-1.5Z"/>
    </svg>
  `;

  let lastScrollY = window.scrollY;
  const updateVisibility = () => {
    backToTop.hidden = false;
    const currentScrollY = window.scrollY;
    const scrollingUp = currentScrollY < lastScrollY;
    const awayFromTop = currentScrollY > 240;

    backToTop.classList.toggle('is-visible', scrollingUp && awayFromTop);
    lastScrollY = currentScrollY;
  };

  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
}

document.addEventListener('DOMContentLoaded', setupBackToTopButton);

if (typeof document$ !== 'undefined') {
  document$.subscribe(setupBackToTopButton);
}

// 打印友好
window.addEventListener('beforeprint', function() {
  // 展开所有折叠的内容
  document.querySelectorAll('details').forEach(detail => {
    detail.setAttribute('open', '');
  });
});

// 键盘快捷键
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + K 打开搜索
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.querySelector('.md-search__input');
    if (searchInput) {
      searchInput.focus();
    }
  }

  // Ctrl/Cmd + / 切换侧边栏
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    const sidebar = document.querySelector('.md-sidebar--primary');
    if (sidebar) {
      sidebar.classList.toggle('md-sidebar--hidden');
    }
  }
});

console.log('Cloud Native Todo Platform 课程文档已加载');
