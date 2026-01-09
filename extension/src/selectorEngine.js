class SelectorEngine {
  constructor() {
    this.maxDepth = 10;
    this.preferredAttributes = ['data-testid', 'data-cy', 'data-test', 'id', 'name', 'aria-label', 'role'];
  }

  getSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const strategies = [
      () => this.getByTestId(element),
      () => this.getById(element),
      () => this.getByAriaLabel(element),
      () => this.getByName(element),
      () => this.getByUniquePath(element),
      () => this.getByNthChild(element)
    ];

    for (const strategy of strategies) {
      try {
        const selector = strategy();
        if (selector && this.isUnique(selector)) {
          return { css: selector, xpath: this.getXPath(element) };
        }
      } catch (e) {
        continue;
      }
    }

    return { css: this.getByNthChild(element), xpath: this.getXPath(element) };
  }

  getByTestId(element) {
    for (const attr of ['data-testid', 'data-cy', 'data-test']) {
      const value = element.getAttribute(attr);
      if (value) {
        return `[${attr}="${this.escapeSelector(value)}"]`;
      }
    }
    return null;
  }

  getById(element) {
    const id = element.id;
    if (id && !this.isGeneratedId(id)) {
      return `#${this.escapeSelector(id)}`;
    }
    return null;
  }

  getByAriaLabel(element) {
    const label = element.getAttribute('aria-label');
    if (label) {
      const tag = element.tagName.toLowerCase();
      return `${tag}[aria-label="${this.escapeSelector(label)}"]`;
    }
    return null;
  }

  getByName(element) {
    const name = element.getAttribute('name');
    if (name) {
      const tag = element.tagName.toLowerCase();
      return `${tag}[name="${this.escapeSelector(name)}"]`;
    }
    return null;
  }

  getByUniquePath(element) {
    const path = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < this.maxDepth) {
      const tag = current.tagName.toLowerCase();
      let selector = tag;

      const id = current.id;
      if (id && !this.isGeneratedId(id)) {
        selector = `#${this.escapeSelector(id)}`;
        path.unshift(selector);
        break;
      }

      const classes = Array.from(current.classList)
        .filter(c => !this.isGeneratedClass(c))
        .slice(0, 2);
      
      if (classes.length > 0) {
        selector = `${tag}.${classes.map(c => this.escapeSelector(c)).join('.')}`;
      }

      path.unshift(selector);
      current = current.parentElement;
      depth++;
    }

    return path.join(' > ');
  }

  getByNthChild(element) {
    const path = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < this.maxDepth) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          path.unshift(`${tag}:nth-of-type(${index})`);
        } else {
          path.unshift(tag);
        }
      } else {
        path.unshift(tag);
      }

      current = parent;
      depth++;
    }

    return path.join(' > ');
  }

  getXPath(element) {
    if (!element) return '';
    
    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tag = current.tagName.toLowerCase();
      const id = current.id;
      
      if (id && !this.isGeneratedId(id)) {
        parts.unshift(`//${tag}[@id="${id}"]`);
        break;
      }
      
      parts.unshift(`${tag}[${index}]`);
      current = current.parentElement;
    }

    return '/' + parts.join('/');
  }

  isUnique(selector) {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1;
    } catch (e) {
      return false;
    }
  }

  isGeneratedId(id) {
    if (!id) return true;
    const patterns = [
      /^[a-f0-9]{8,}$/i,
      /^:r[0-9a-z]+:$/,
      /^ember\d+$/,
      /^ext-gen\d+$/,
      /^react-select-\d+/,
      /^\d+$/,
      /^[a-z]{2,4}-[a-f0-9]{6,}$/i
    ];
    return patterns.some(p => p.test(id));
  }

  isGeneratedClass(className) {
    if (!className) return true;
    const patterns = [
      /^[a-z]{1,3}[A-Z][a-zA-Z0-9]{10,}$/,
      /^css-[a-z0-9]+$/,
      /^sc-[a-zA-Z0-9]+$/,
      /^emotion-\d+$/,
      /^_[a-zA-Z0-9]{5,}$/,
      /^[a-f0-9]{6,}$/i
    ];
    return patterns.some(p => p.test(className));
  }

  escapeSelector(str) {
    return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  getElementDescription(element) {
    const tag = element.tagName.toLowerCase();
    const type = element.type || '';
    const text = this.getElementText(element);
    const ariaLabel = element.getAttribute('aria-label');
    const placeholder = element.getAttribute('placeholder');
    const title = element.getAttribute('title');
    const alt = element.alt;

    let description = tag;
    
    if (tag === 'input') {
      description = type ? `${type} input` : 'input';
      if (placeholder) description += ` "${placeholder}"`;
    } else if (tag === 'button' || element.getAttribute('role') === 'button') {
      description = 'button';
      if (text) description += ` "${text}"`;
    } else if (tag === 'a') {
      description = 'link';
      if (text) description += ` "${text}"`;
    } else if (tag === 'select') {
      description = 'dropdown';
    } else if (tag === 'img') {
      description = 'image';
      if (alt) description += ` "${alt}"`;
    } else if (text) {
      description += ` "${text}"`;
    }

    if (!text && ariaLabel) {
      description += ` (${ariaLabel})`;
    }

    return description;
  }

  getElementText(element) {
    const directText = element.textContent?.trim();
    if (directText && directText.length <= 50) {
      return directText.substring(0, 50);
    }
    
    const innerText = element.innerText?.trim();
    if (innerText && innerText.length <= 50) {
      return innerText.substring(0, 50);
    }

    return '';
  }

  getElementBounds(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportX: Math.round(rect.left),
      viewportY: Math.round(rect.top)
    };
  }
}

if (typeof window !== 'undefined') {
  window.FlowCaptureSelectorEngine = new SelectorEngine();
}
