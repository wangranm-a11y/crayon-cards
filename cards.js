/* ==========================================================
   蜡笔卡 v2 · 卡片渲染 (DOM + html2canvas)
   • 5 个主题，每个用 CSS class 定义
   • 输出 1080×1440 (3:4)，预览用 transform:scale 缩小
   • 智能分页：按真实渲染高度分卡，除最后一页外都填满
   • 支持富文本（粗/斜/下划线/颜色/图片）
   ========================================================== */

window.CARDS = (function () {

  const W = 1080, H = 1440;

  const THEMES = {
    cream: {
      name: '米色信笺',
      previewBg: 'linear-gradient(180deg, #fbf6e9, #f0e8d0)',
    },
    indigo: {
      name: '暗夜诗笺',
      previewBg: 'linear-gradient(180deg, #1c1838, #0a0820)',
    },
    pastel: {
      name: '春日卡片',
      previewBg: 'linear-gradient(135deg, #ffe8e8, #fff5e8 50%, #e8f0ff)',
    },
    charcoal: {
      name: '炭笔速写',
      previewBg: '#f5f1e6',
    },
    magazine: {
      name: '杂志大字',
      previewBg: '#fafafa',
    },
  };

  /**
   * 创建一张卡片 DOM 元素（包括布局与装饰）
   * @returns {HTMLElement} 卡片元素
   */
  function makeCardEl(themeKey, opts = {}) {
    const { nickname = '蜡笔不拿笔', pageIndex = 0, totalPages = 1, showPage = true, showNickname = true } = opts;
    const card = document.createElement('div');
    card.className = `card card-${themeKey}`;
    card.setAttribute('data-theme', themeKey);

    // 装饰层（顶/底装饰线、星点）
    const deco = document.createElement('div');
    deco.className = 'card-deco';
    card.appendChild(deco);

    // 昵称印章
    if (showNickname) {
      const stamp = document.createElement('div');
      stamp.className = 'card-stamp';
      stamp.innerHTML = `<span class="card-stamp-dot"></span><span class="card-stamp-name">${escapeHtml(nickname)}</span>`;
      card.appendChild(stamp);
    }

    // 内容容器
    const content = document.createElement('div');
    content.className = 'card-content';
    card.appendChild(content);

    // 页码
    if (showPage && totalPages > 1) {
      const page = document.createElement('div');
      page.className = 'card-page';
      page.textContent = `${pageIndex + 1} / ${totalPages}`;
      card.appendChild(page);
    }

    return card;
  }

  /**
   * 智能分页：按实际渲染高度切分内容
   * @param {HTMLElement} sourceEditor — contenteditable 编辑器（已含富文本）
   * @param {string} themeKey
   * @param {object} opts
   * @returns {Array<{contentHTML:string, isCover:boolean}>}
   */
  function splitIntoPages(sourceEditor, themeKey, opts = {}) {
    // 把编辑器内容拆成块（p / div / img / ul / ol / blockquote / h1-h6 / hr）
    const blocks = extractBlocks(sourceEditor);
    if (blocks.length === 0) return [];

    // 创建一张测试卡（屏外，正式 1080×1440 尺寸）
    const test = makeCardEl(themeKey, opts);
    test.classList.add('card-offscreen');
    document.body.appendChild(test);
    const content = test.querySelector('.card-content');

    const pages = [];
    let buffer = []; // 当前页累积的 HTML 字符串

    function commit() {
      if (buffer.length) {
        pages.push(buffer.join(''));
        buffer = [];
      }
    }

    function tryFit(htmlToAdd) {
      content.innerHTML = buffer.join('') + htmlToAdd;
      // contentHeight vs containerHeight
      return content.scrollHeight <= content.clientHeight + 2; // 2px 容差
    }

    for (const block of blocks) {
      const html = block.outerHTML;
      if (tryFit(html)) {
        buffer.push(html);
        continue;
      }
      // 装不下：先 commit 当前页（如果有内容）
      if (buffer.length > 0) {
        commit();
      }
      // 现在 buffer 为空，再试一次
      if (tryFit(html)) {
        buffer.push(html);
      } else {
        // 单个块都装不下 → 拆它
        const subBlocks = splitOneBlock(block, content);
        for (const sub of subBlocks) {
          if (tryFit(sub.outerHTML)) {
            buffer.push(sub.outerHTML);
          } else {
            commit();
            buffer.push(sub.outerHTML);
          }
        }
      }
    }
    commit();

    document.body.removeChild(test);
    return pages.map((html, i) => ({ contentHTML: html, isCover: false }));
  }

  /**
   * 从编辑器抽出"块"级元素列表
   */
  function extractBlocks(editor) {
    const blocks = [];
    Array.from(editor.childNodes).forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.tagName === 'BR') return;
        blocks.push(n);
      } else if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent.trim();
        if (text) {
          // 把裸文本包成 <p>
          const p = document.createElement('p');
          p.textContent = text;
          blocks.push(p);
        }
      }
    });
    return blocks;
  }

  /**
   * 把单个塞不下的块按句/字符再拆
   */
  function splitOneBlock(block, fitContainer) {
    const tagName = block.tagName;
    // 图片单独成块装不下 → 强行缩小
    if (tagName === 'IMG') {
      block.style.maxHeight = '60%';
      block.style.objectFit = 'contain';
      return [block];
    }

    const text = block.textContent;
    if (!text || text.length < 4) return [block];

    // 按句号 / 换行拆
    const sentences = text.split(/(?<=[。！？.!?\n])/).filter(s => s.trim());

    const parts = [];
    let current = '';

    for (const s of sentences) {
      const tryHTML = `<${tagName.toLowerCase()}>${escapeHtml(current + s)}</${tagName.toLowerCase()}>`;
      fitContainer.innerHTML = tryHTML;
      if (fitContainer.scrollHeight <= fitContainer.clientHeight + 2) {
        current += s;
      } else {
        if (current) {
          const el = document.createElement(tagName);
          el.textContent = current;
          parts.push(el);
        }
        current = s;
      }
    }
    if (current) {
      const el = document.createElement(tagName);
      el.textContent = current;
      parts.push(el);
    }

    // 兜底：如果 sentence 拆完还塞不下（极长一句），按字符暴力拆
    if (parts.length === 0) {
      const chunks = [];
      let chunk = '';
      for (let i = 0; i < text.length; i++) {
        const test = chunk + text[i];
        const el = document.createElement(tagName);
        el.textContent = test;
        fitContainer.innerHTML = el.outerHTML;
        if (fitContainer.scrollHeight <= fitContainer.clientHeight + 2) {
          chunk = test;
        } else {
          if (chunk) {
            const e = document.createElement(tagName);
            e.textContent = chunk;
            chunks.push(e);
          }
          chunk = text[i];
        }
      }
      if (chunk) {
        const e = document.createElement(tagName);
        e.textContent = chunk;
        chunks.push(e);
      }
      return chunks;
    }
    return parts;
  }

  /**
   * 把封面（带大字标题）单独造一张
   */
  function makeCoverPage(title, themeKey, opts) {
    const card = makeCardEl(themeKey, opts);
    card.classList.add('card-cover');
    const content = card.querySelector('.card-content');
    const t = document.createElement('h1');
    t.className = 'cover-title';
    t.textContent = title;
    content.appendChild(t);
    return card;
  }

  /**
   * 渲染一张内容卡（不带 cover）
   */
  function makeContentPage(htmlContent, themeKey, opts) {
    const card = makeCardEl(themeKey, opts);
    const content = card.querySelector('.card-content');
    content.innerHTML = htmlContent;
    return card;
  }

  /**
   * 用 html2canvas 把一张卡片导出为 PNG Blob
   * 关键修复：克隆到屏外、去掉 transform，让 html2canvas 拿到真实 1080×1440 渲染
   */
  async function cardToPng(cardEl) {
    if (!window.html2canvas) {
      throw new Error('html2canvas not loaded');
    }

    // 1. 克隆卡片
    const clone = cardEl.cloneNode(true);
    // 2. 去掉所有 transform，强制实际 1080×1440
    clone.style.cssText = `
      position: absolute; left: -10000px; top: 0;
      transform: none !important;
      width: ${W}px; height: ${H}px;
      pointer-events: none;
    `;
    document.body.appendChild(clone);

    // 3. 等所有内嵌图片加载完
    await Promise.all(
      Array.from(clone.querySelectorAll('img')).map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(r => {
          img.onload = r;
          img.onerror = r;
          // 安全超时 8 秒
          setTimeout(r, 8000);
        });
      })
    );

    // 等浏览器再画一帧，确保布局稳定
    await new Promise(r => requestAnimationFrame(r));

    try {
      const canvas = await window.html2canvas(clone, {
        width: W,
        height: H,
        windowWidth: W,
        windowHeight: H,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 1,
      });
      return new Promise(r => canvas.toBlob(b => r(b), 'image/png', 0.95));
    } finally {
      if (clone.parentNode) clone.parentNode.removeChild(clone);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  return {
    THEMES,
    themesList: () => Object.entries(THEMES).map(([k, v]) => ({ key: k, name: v.name, previewBg: v.previewBg })),
    splitIntoPages,
    makeContentPage,
    makeCoverPage,
    makeCardEl,
    cardToPng,
    W, H,
  };
})();
