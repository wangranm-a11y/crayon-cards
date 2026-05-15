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
    // —— 新增 6 个 ——
    minimal: {
      name: '极简白',
      previewBg: '#ffffff',
    },
    sunset: {
      name: '晚霞',
      previewBg: 'linear-gradient(180deg, #ffd6a0 0%, #ff8a9c 50%, #c084fc 100%)',
    },
    latte: {
      name: '奶咖',
      previewBg: 'linear-gradient(180deg, #f5e6d3 0%, #e8d0b3 100%)',
    },
    lavender: {
      name: '薰衣草',
      previewBg: 'linear-gradient(180deg, #f3eaff 0%, #e9d8ff 100%)',
    },
    neon: {
      name: '暗夜霓虹',
      previewBg: 'linear-gradient(180deg, #0a0a18 0%, #1a0a2e 100%)',
    },
    classical: {
      name: '古籍',
      previewBg: '#ede0c8',
    },
    editorial: {
      name: '编辑手记',
      previewBg: '#f5efe2',
    },
    violet: {
      name: '紫夜',
      previewBg: '#0a0a0a',
    },
    noir: {
      name: '墨紫',
      previewBg: '#000000',
    },
  };

  /**
   * 创建一张卡片 DOM 元素（包括布局与装饰）
   * @returns {HTMLElement} 卡片元素
   */
  function makeCardEl(themeKey, opts = {}) {
    const {
      nickname = '蜡笔不拿笔',
      pageIndex = 0, totalPages = 1,
      showPage = true, showNickname = true,
      tag = '', font = 'default',
      textColor = 'default',
      avatar = 'icons/avatar.png',
    } = opts;
    const card = document.createElement('div');
    let cls = `card card-${themeKey}`;
    if (font && font !== 'default') cls += ` card-font-${font}`;
    card.className = cls;
    card.setAttribute('data-theme', themeKey);

    // 全局正文颜色覆盖（继承 + CSS 变量双管齐下，覆盖各主题已显式设置的 p/blockquote 色）
    if (textColor && textColor !== 'default') {
      card.style.color = textColor;
      card.style.setProperty('--card-text-color', textColor);
    }

    // 装饰层（顶/底装饰线、星点）
    const deco = document.createElement('div');
    deco.className = 'card-deco';
    card.appendChild(deco);

    // 章节号 "01" "02" ...（默认隐藏，仅 editorial 主题显示）
    const chapterNum = document.createElement('div');
    chapterNum.className = 'card-chapter-num';
    chapterNum.textContent = String(pageIndex + 1).padStart(2, '0');
    card.appendChild(chapterNum);

    // 头像区域（showNickname 时显示；所有主题默认小图横排，noir 主题通过 CSS 放大）
    if (showNickname) {
      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'card-avatar-wrap';
      avatarWrap.innerHTML = `
        <img class="card-avatar" src="${escapeHtml(avatar)}" alt="avatar" />
        <div class="card-avatar-name">@${escapeHtml(nickname)}</div>
      `;
      card.appendChild(avatarWrap);
    }

    // 内容容器
    const content = document.createElement('div');
    content.className = 'card-content';
    card.appendChild(content);

    // 标签 pill（每张卡左下角，可选）
    if (tag) {
      const tagEl = document.createElement('div');
      tagEl.className = 'card-tag';
      const t = String(tag).trim().replace(/^#\s*/, '');
      tagEl.textContent = `# ${t}`;
      card.appendChild(tagEl);
    }

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

    // 行内格式标签（不当作断点）；其他元素子（如 <li>/<p>/<div>）算天然断点
    const INLINE_TAGS = new Set([
      'B','I','U','EM','STRONG','SPAN','A','CODE','SMALL',
      'SUB','SUP','MARK','FONT','S','STRIKE','DEL','INS','Q'
    ]);

    // 把一个块拆成「token」序列：保留行内格式（<b>/<i>/<u>/<span>），
    // 纯文本按句号 / ！？ / 分号 / 换行切；非行内子元素（如 <li>）算断点。
    function tokenizeBlock(block) {
      const tokens = [];
      for (const child of Array.from(block.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent;
          if (!text) continue;
          // 句末标点 + 分号 + 换行切，保留分隔符
          const parts = text.split(/(?<=[。！？.!?；;\n])/);
          for (const p of parts) {
            if (!p) continue;
            tokens.push({
              type: 'text',
              text: p,
              html: escapeHtml(p),
              endsAtBoundary: /[。！？.!?；;\n]$/.test(p),
            });
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // 行内格式（<b>/<i>/<span>...）不是断点；
          // 块级子元素（<li>/<p>/<div>/<br>）是天然断点
          const isInline = INLINE_TAGS.has(child.tagName);
          tokens.push({ type: 'element', html: child.outerHTML, endsAtBoundary: !isInline });
        }
      }
      return tokens;
    }

    // 用二分查找：在 fittedHTML 基础上，往一个文本最多再塞多少字符还能 fit
    function findMaxCharsFit(block, fittedHTML, text) {
      let lo = 1, hi = text.length, best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const tryEl = block.cloneNode(false);
        tryEl.innerHTML = fittedHTML + escapeHtml(text.slice(0, mid));
        if (tryFit(tryEl.outerHTML)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      // 英文回退：避免切单词中间
      if (best > 0 && best < text.length) {
        const left = text[best - 1], right = text[best];
        if (/[A-Za-z0-9]/.test(left) && /[A-Za-z0-9]/.test(right)) {
          let p = best;
          while (p > 0 && /[A-Za-z0-9]/.test(text[p - 1])) p--;
          if (p > 0) best = p;
        }
      }
      return best;
    }

    // 贪心地把一个塞不下的块按句号 / 字符填到当前卡的剩余空间里，
    // 返回 { fitted: bool, remainder: HTMLElement | null }
    // fitted=true 表示「至少有一些内容被塞进了当前卡」，buffer 已被 push。
    function greedyPackSentences(block) {
      // 不可拆类型：图片 / 横线 → 让外层走拆块或新开一页
      if (block.tagName === 'IMG' || block.tagName === 'HR') {
        return { fitted: false, remainder: block };
      }

      const tokens = tokenizeBlock(block);
      if (tokens.length === 0) return { fitted: false, remainder: block };

      let fittedHTML = '';
      let lastCutHTML = '';        // 已 commit 的最近"好切点"
      let lastCutTokenIdx = -1;    // 该切点对应的 token 索引
      let charSplitRemainder = ''; // 文本 token 被字符级切开后剩的部分

      for (let i = 0; i < tokens.length; i++) {
        const cloneEl = block.cloneNode(false);
        cloneEl.innerHTML = fittedHTML + tokens[i].html;
        if (tryFit(cloneEl.outerHTML)) {
          fittedHTML += tokens[i].html;
          if (tokens[i].endsAtBoundary) {
            lastCutHTML = fittedHTML;
            lastCutTokenIdx = i;
            charSplitRemainder = '';
          }
        } else {
          // 当前 token 整段塞不下；如果是文本，按字符再榨一榨
          if (tokens[i].type === 'text' && tokens[i].text.length > 1) {
            const maxChars = findMaxCharsFit(block, fittedHTML, tokens[i].text);
            if (maxChars > 0) {
              fittedHTML += escapeHtml(tokens[i].text.slice(0, maxChars));
              lastCutHTML = fittedHTML;
              lastCutTokenIdx = i;
              charSplitRemainder = tokens[i].text.slice(maxChars);
            }
          }
          break;
        }
      }

      if (lastCutTokenIdx < 0) {
        // 连一个字都塞不下 → 让外层处理
        return { fitted: false, remainder: block };
      }

      // 把可填的部分推入当前卡
      const fittedEl = block.cloneNode(false);
      fittedEl.innerHTML = lastCutHTML;
      buffer.push(fittedEl.outerHTML);

      // 组装 remainder（字符切剩下的尾巴 + 后续 tokens）
      let remainderHTML = charSplitRemainder ? escapeHtml(charSplitRemainder) : '';
      for (let j = lastCutTokenIdx + 1; j < tokens.length; j++) {
        remainderHTML += tokens[j].html;
      }
      if (!remainderHTML.replace(/\s/g, '')) {
        return { fitted: true, remainder: null };
      }
      const remainder = block.cloneNode(false);
      remainder.innerHTML = remainderHTML;
      return { fitted: true, remainder };
    }

    // 用队列处理：remainder 会被 unshift 回去，下一轮在新卡上继续填
    const queue = blocks.slice();

    while (queue.length > 0) {
      const block = queue.shift();
      const html = block.outerHTML;

      // 1) 整块能塞进当前卡 → 直接塞
      if (tryFit(html)) {
        buffer.push(html);
        continue;
      }

      // 2) 当前卡已有内容 → 先尝试句级贪心填满
      if (buffer.length > 0) {
        const r = greedyPackSentences(block);
        if (r.fitted) {
          commit();
          if (r.remainder) queue.unshift(r.remainder);
          continue;
        }
        // 一句都塞不下 → 提交当前卡，下一轮在空卡上重试
        commit();
      }

      // 3) buffer 为空，再试一次整块
      if (tryFit(html)) {
        buffer.push(html);
        continue;
      }

      // 4) 空卡仍装不下 → 先尝试句级贪心填空卡
      const r2 = greedyPackSentences(block);
      if (r2.fitted) {
        commit();
        if (r2.remainder) queue.unshift(r2.remainder);
        continue;
      }

      // 5) 句级也搞不定（无句号的极长一句 / 图片） → 走兜底拆块
      const subBlocks = splitOneBlock(block, content);
      // 反向 unshift，保持顺序
      for (let i = subBlocks.length - 1; i >= 0; i--) {
        queue.unshift(subBlocks[i]);
      }
    }
    commit();

    document.body.removeChild(test);
    return pages.map((html, i) => ({ contentHTML: html, isCover: false }));
  }

  /**
   * 从编辑器抽出"块"级元素列表
   * - <ul>/<ol> 会被拆成 N 个单 item 列表，方便分页器逐条打包
   * - <ol> 拆开时保留 start 序号
   * - <div> 包含的块级子元素会被提到顶层
   */
  function flattenList(listEl) {
    const tag = listEl.tagName; // UL or OL
    const out = [];
    let counter = 1;
    for (const li of Array.from(listEl.children)) {
      if (li.tagName !== 'LI') continue;
      const wrapper = document.createElement(tag);
      // 复制原列表的 class / style 属性，主题样式不丢
      if (listEl.className) wrapper.className = listEl.className;
      if (listEl.getAttribute('style')) wrapper.setAttribute('style', listEl.getAttribute('style'));
      if (tag === 'OL') wrapper.setAttribute('start', String(counter));
      wrapper.appendChild(li.cloneNode(true));
      // 标记一下，方便 CSS 让相邻拆出来的列表无缝衔接
      wrapper.setAttribute('data-li-flat', '1');
      out.push(wrapper);
      counter++;
    }
    return out.length > 0 ? out : [listEl];
  }

  function extractBlocks(editor) {
    const blocks = [];
    Array.from(editor.childNodes).forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.tagName === 'BR') return;
        if (n.tagName === 'UL' || n.tagName === 'OL') {
          flattenList(n).forEach(b => blocks.push(b));
          return;
        }
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
