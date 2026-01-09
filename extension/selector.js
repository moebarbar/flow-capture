const Selector = {
  generate(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

    if (element.id && !element.id.match(/^\d/)) {
      return `#${CSS.escape(element.id)}`;
    }

    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body && path.length < 5) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => 
          c && !c.match(/^(hover|active|focus|visited|disabled)/)
        ).slice(0, 2);
        if (classes.length) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
      }

      const siblings = current.parentElement?.children || [];
      const sameTagSiblings = Array.from(siblings).filter(s => s.tagName === current.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  },

  isInteractable(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    
    const interactableTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
    const interactableRoles = ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio'];
    
    if (interactableTags.includes(tag)) return true;
    if (role && interactableRoles.includes(role)) return true;
    if (element.onclick || element.hasAttribute('onclick')) return true;
    if (element.hasAttribute('tabindex') && element.tabIndex >= 0) return true;
    
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') return true;
    
    return false;
  },

  isOverlayElement(element) {
    let current = element;
    while (current) {
      if (current.id === 'flowcapture-overlay' || current.classList?.contains('flowcapture-overlay')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  },

  getDescription(element) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim().substring(0, 50) || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const placeholder = element.placeholder || '';
    const type = element.type || '';

    if (tag === 'button' || element.getAttribute('role') === 'button') {
      return `Click "${text || ariaLabel || 'button'}"`;
    }
    if (tag === 'a') {
      return `Click "${text || 'link'}"`;
    }
    if (tag === 'input') {
      if (type === 'submit' || type === 'button') {
        return `Click "${element.value || 'Submit'}"`;
      }
      if (type === 'checkbox') {
        return `Toggle "${ariaLabel || text || 'checkbox'}"`;
      }
      if (type === 'radio') {
        return `Select "${ariaLabel || text || 'option'}"`;
      }
      return `Enter text in "${placeholder || ariaLabel || 'field'}"`;
    }
    if (tag === 'select') {
      return `Select from "${ariaLabel || 'dropdown'}"`;
    }
    if (tag === 'textarea') {
      return `Enter text in "${placeholder || ariaLabel || 'text area'}"`;
    }
    
    return `Click ${text ? `"${text}"` : tag}`;
  }
};

if (typeof window !== 'undefined') {
  window.FlowCaptureSelector = Selector;
}
