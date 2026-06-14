/* ==========================================================
   蜡笔卡 v2 · 主程序
   • 富文本编辑器 (contenteditable)
   • 工具栏：粗/斜/下划线/颜色/图片/列表/引言/清除
   • 智能分页（DOM 真实高度）
   • DOM-to-PNG 导出
   ========================================================== */

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const state = {
    title: '',
    nickname: localStorage.getItem('cc.nickname') || '蜡笔不拿笔',
    theme: localStorage.getItem('cc.theme') || 'cream',
    font: localStorage.getItem('cc.font') || 'default',
    fontSize: localStorage.getItem('cc.fontSize') || '44',
    textColor: localStorage.getItem('cc.textColor') || 'default',
    tag: localStorage.getItem('cc.tag') || '',
    showPage: true,
    showNickname: true,
    autoCover: true,
    color: localStorage.getItem('cc.color') || '#c84b31',
    avatar: localStorage.getItem('cc.avatar') || 'icons/avatar.png',
    cards: [], // 渲染好的卡片元素列表
  };

  // ============ Refs ============
  const editor = $('#editor');
  const toolbar = $('#toolbar');
  const titleEl = $('#titleInput');
  const tagEl = $('#tagInput');
  const nickEl = $('#nicknameInput');
  const colorIcon = $('#colorIcon');
  const colorInput = $('#textColor');
  const showPageEl = $('#showPage');
  const showNickEl = $('#showNickname');
  const autoCoverEl = $('#autoCover');
  const fileInput = $('#imageFile');
  const avatarInput = $('#avatarInput');

  // ============ Init ============
  nickEl.value = state.nickname;
  if (tagEl) tagEl.value = state.tag;
  showPageEl.checked = true;
  showNickEl.checked = true;
  autoCoverEl.checked = true;
  colorInput.value = state.color;
  colorIcon.style.color = state.color;

  // Avatar upload
  if (avatarInput) {
    avatarInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        state.avatar = ev.target.result;
        localStorage.setItem('cc.avatar', state.avatar);
        if (!$('#previewView').hidden) regenerate();
      };
      reader.readAsDataURL(file);
    });
  }

  // Font picker
  const fontWrap = $('#fontPicker');
  if (fontWrap) {
    fontWrap.querySelectorAll('.font-btn').forEach(b => {
      if (b.dataset.font === state.font) b.classList.add('active');
      b.addEventListener('click', () => {
        fontWrap.querySelectorAll('.font-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        state.font = b.dataset.font;
        localStorage.setItem('cc.font', state.font);
        if (!$('#previewView').hidden) regenerate();
      });
    });
  }

  // Font size picker (buttons + slider)
  const fsSlider = $('#fontsizeSlider');
  const fsLabel = $('#fontsizeLabel');
  const fsButtons = document.querySelectorAll('.fs-btn');

  function setFontSize(sizePx) {
    state.fontSize = String(sizePx);
    localStorage.setItem('cc.fontSize', state.fontSize);
    if (fsSlider) fsSlider.value = sizePx;
    if (fsLabel) fsLabel.textContent = sizePx + 'px';
    fsButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.size === String(sizePx));
    });
    if (!$('#previewView').hidden) regenerate();
  }

  if (fsSlider) {
    fsSlider.value = state.fontSize;
  }
  if (fsLabel) {
    fsLabel.textContent = state.fontSize + 'px';
  }
  // init button state
  fsButtons.forEach(b => {
    if (b.dataset.size === state.fontSize) b.classList.add('active');
    b.addEventListener('click', () => setFontSize(b.dataset.size));
  });
  // slider input
  if (fsSlider) {
    fsSlider.addEventListener('input', () => {
      const v = fsSlider.value;
      if (fsLabel) fsLabel.textContent = v + 'px';
      fsButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.size === v);
      });
    });
    fsSlider.addEventListener('change', () => {
      setFontSize(fsSlider.value);
    });
  }

  // Text color picker
  const tcWrap = $('#textColorPicker');
  if (tcWrap) {
    const tcInput  = $('#tcCustomInput');
    const tcCustom = $('#tcCustom');
    const tcCustomIcon = $('#tcCustomIcon');

    function activateTc(el, color) {
      tcWrap.querySelectorAll('.tc-btn, .tc-swatch, .tc-custom').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.textColor = color;
      localStorage.setItem('cc.textColor', state.textColor);
      if (!$('#previewView').hidden) regenerate();
    }

    // 初始化激活态
    const presetMatch = tcWrap.querySelector(`[data-color="${state.textColor}"]`);
    if (presetMatch) presetMatch.classList.add('active');
    else if (state.textColor !== 'default' && tcCustom) {
      tcCustom.classList.add('active');
      if (tcInput) tcInput.value = state.textColor;
      if (tcCustomIcon) tcCustomIcon.style.background = state.textColor;
    }

    tcWrap.querySelectorAll('.tc-btn, .tc-swatch').forEach(b => {
      b.addEventListener('click', () => activateTc(b, b.dataset.color));
    });
    if (tcInput) {
      tcInput.addEventListener('input', e => {
        const color = e.target.value;
        if (tcCustomIcon) tcCustomIcon.style.background = color;
        activateTc(tcCustom, color);
      });
    }
  }

  // 渲染主题选项
  const themeWrap = $('#themePicker');
  themeWrap.innerHTML = window.CARDS.themesList().map(t => `
    <button type="button" class="theme-btn ${t.key === state.theme ? 'active' : ''}" data-theme="${t.key}">
      <span class="theme-preview theme-${t.key}"></span>
      <span class="theme-name">${t.name}</span>
    </button>
  `).join('');
  themeWrap.querySelectorAll('.theme-btn').forEach(b => {
    b.addEventListener('click', () => {
      themeWrap.querySelectorAll('.theme-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.theme = b.dataset.theme;
      localStorage.setItem('cc.theme', state.theme);
      // 如已生成，重新渲染
      if (!$('#previewView').hidden) regenerate();
    });
  });

  // ============ 富文本工具栏 ============
  toolbar.querySelectorAll('.rt-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault()); // 防失焦
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const arg = btn.dataset.arg || null;
      if (!cmd) return;
      editor.focus();
      try { document.execCommand(cmd, false, arg); } catch (e) {}
      updateToolbarActive();
    });
  });

  // ============ 单段染色 popover ============
  const rtColorBtn = $('#rtColorBtn');
  const rtColorPopover = $('#rtColorPopover');
  const rtColorCustom = rtColorPopover ? rtColorPopover.querySelector('.rt-cp-custom') : null;

  function positionColorPopover() {
    const rect = rtColorBtn.getBoundingClientRect();
    rtColorPopover.style.top = `${rect.bottom + 6}px`;
    let left = rect.left;
    // 防止溢出右侧
    const pw = rtColorPopover.offsetWidth || 320;
    const maxLeft = document.documentElement.clientWidth - pw - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    rtColorPopover.style.left = `${left}px`;
  }
  function closeColorPopover() {
    if (!rtColorPopover) return;
    rtColorPopover.hidden = true;
    rtColorBtn.classList.remove('active');
  }
  function applyTextColor(color) {
    editor.focus();
    try {
      if (color === 'default') {
        // 清掉选中文字的颜色（用 inherit 让父元素颜色透出）
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, 'inherit');
      } else {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, color);
        state.color = color;
        colorIcon.style.color = color;
        if (colorInput) colorInput.value = color;
        localStorage.setItem('cc.color', state.color);
      }
    } catch (err) {}
    closeColorPopover();
  }
  if (rtColorBtn && rtColorPopover) {
    rtColorBtn.addEventListener('mousedown', e => e.preventDefault());
    rtColorBtn.addEventListener('click', () => {
      closeFsPopover();
      const willShow = rtColorPopover.hidden;
      rtColorPopover.hidden = !willShow;
      rtColorBtn.classList.toggle('active', willShow);
      if (willShow) positionColorPopover();
    });
    rtColorPopover.querySelectorAll('.rt-cp-swatch, .rt-cp-default').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => applyTextColor(b.dataset.color));
    });
    if (rtColorCustom) rtColorCustom.addEventListener('mousedown', e => e.preventDefault());
    if (colorInput) colorInput.addEventListener('input', e => applyTextColor(e.target.value));
    document.addEventListener('mousedown', e => {
      if (!rtColorBtn.contains(e.target) && !rtColorPopover.contains(e.target)) {
        closeColorPopover();
      }
    });
    window.addEventListener('scroll', () => { if (!rtColorPopover.hidden) positionColorPopover(); }, { passive: true });
    window.addEventListener('resize', () => { if (!rtColorPopover.hidden) positionColorPopover(); });
  }

  // ============ 单段字号 popover ============
  const rtFsBtn = $('#rtFontSizeBtn');
  const rtFsPopover = $('#rtFsPopover');

  function positionFsPopover() {
    if (!rtFsBtn || !rtFsPopover) return;
    const rect = rtFsBtn.getBoundingClientRect();
    rtFsPopover.style.top = `${rect.bottom + 6}px`;
    let left = rect.left;
    const pw = rtFsPopover.offsetWidth || 280;
    const maxLeft = document.documentElement.clientWidth - pw - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    rtFsPopover.style.left = `${left}px`;
  }
  function closeFsPopover() {
    if (!rtFsPopover) return;
    rtFsPopover.hidden = true;
    if (rtFsBtn) rtFsBtn.classList.remove('active');
  }
  function applyPartialFontSize(px) {
    editor.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { closeFsPopover(); return; }
    try {
      if (px === 'default') {
        // 清除选中区域的 font-size span
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('removeFormat', false, null);
      } else {
        const range = sel.getRangeAt(0);
        const content = range.extractContents();
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.appendChild(content);
        range.insertNode(span);
        sel.removeAllRanges();
      }
    } catch (e) { /* ignore */ }
    closeFsPopover();
  }
  if (rtFsBtn && rtFsPopover) {
    rtFsBtn.addEventListener('mousedown', e => e.preventDefault());
    rtFsBtn.addEventListener('click', () => {
      const willShow = rtFsPopover.hidden;
      // 关闭颜色 popover
      closeColorPopover();
      rtFsPopover.hidden = !willShow;
      rtFsBtn.classList.toggle('active', willShow);
      if (willShow) positionFsPopover();
    });
    rtFsPopover.querySelectorAll('[data-fs]').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => applyPartialFontSize(b.dataset.fs));
    });
    document.addEventListener('mousedown', e => {
      if (!rtFsBtn.contains(e.target) && !rtFsPopover.contains(e.target)) {
        closeFsPopover();
      }
    });
    window.addEventListener('scroll', () => { if (!rtFsPopover.hidden) positionFsPopover(); }, { passive: true });
    window.addEventListener('resize', () => { if (!rtFsPopover.hidden) positionFsPopover(); });
  }

  // ============ 图片选中 + 浮动工具栏 ============
  const imgToolbar = $('#imageToolbar');
  let selectedImg = null;

  function getEditorBlock(node) {
    let cur = node;
    while (cur && cur.parentNode !== editor) {
      cur = cur.parentNode;
      if (!cur || !editor.contains(cur)) return null;
    }
    return cur;
  }
  function positionImgToolbar(img) {
    const rect = img.getBoundingClientRect();
    const tbH = imgToolbar.offsetHeight || 40;
    const margin = 6;
    let top = rect.top - tbH - margin;
    if (top < 8) top = rect.bottom + margin;
    let left = rect.left;
    const tbW = imgToolbar.offsetWidth || 200;
    const maxLeft = document.documentElement.clientWidth - tbW - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    imgToolbar.style.top = `${top}px`;
    imgToolbar.style.left = `${left}px`;
  }
  function selectImageEl(img) {
    editor.querySelectorAll('img.cc-selected').forEach(x => x.classList.remove('cc-selected'));
    img.classList.add('cc-selected');
    selectedImg = img;
    imgToolbar.hidden = false;
    positionImgToolbar(img);
  }
  function deselectImageEl() {
    if (!selectedImg) return;
    editor.querySelectorAll('img.cc-selected').forEach(x => x.classList.remove('cc-selected'));
    selectedImg = null;
    imgToolbar.hidden = true;
  }

  if (imgToolbar) {
    editor.addEventListener('click', e => {
      if (e.target.tagName === 'IMG') selectImageEl(e.target);
      else deselectImageEl();
    });
    document.addEventListener('mousedown', e => {
      if (!editor.contains(e.target) && !imgToolbar.contains(e.target)) deselectImageEl();
    });
    window.addEventListener('scroll', () => { if (selectedImg) positionImgToolbar(selectedImg); }, { passive: true });
    window.addEventListener('resize', () => { if (selectedImg) positionImgToolbar(selectedImg); });

    imgToolbar.querySelectorAll('.img-tb-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => {
        if (!selectedImg) return;
        const act = btn.dataset.act;
        const img = selectedImg;
        const block = getEditorBlock(img);
        if (!block) return;

        const others = Array.from(block.childNodes).filter(n => n !== img);
        const blockHasOther = others.some(n =>
          (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) ||
          (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'BR')
        );

        switch (act) {
          case 'up': {
            const prev = block.previousElementSibling;
            if (prev) editor.insertBefore(block, prev);
            break;
          }
          case 'down': {
            const next = block.nextElementSibling;
            if (next) editor.insertBefore(next, block);
            break;
          }
          case 'duplicate': {
            if (!blockHasOther) {
              const clone = block.cloneNode(true);
              clone.querySelectorAll('img.cc-selected').forEach(x => x.classList.remove('cc-selected'));
              block.parentNode.insertBefore(clone, block.nextSibling);
            } else {
              const imgClone = img.cloneNode(true);
              imgClone.classList.remove('cc-selected');
              img.parentNode.insertBefore(imgClone, img.nextSibling);
            }
            break;
          }
          case 'delete': {
            if (!blockHasOther && block !== editor) block.remove();
            else img.remove();
            deselectImageEl();
            updateCharCount();
            return;
          }
        }
        positionImgToolbar(img);
        updateCharCount();
      });
    });
  }

  // 插图按钮
  $('#insertImage').addEventListener('mousedown', e => e.preventDefault());
  $('#insertImage').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const url = await fileToDataUrl(f);
      insertImage(url);
    }
    e.target.value = '';
  });

  // 拖拽图片到编辑器
  editor.addEventListener('drop', async e => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) {
      if (!f.type.startsWith('image/')) continue;
      const url = await fileToDataUrl(f);
      insertImage(url);
    }
  });
  editor.addEventListener('dragover', e => e.preventDefault());

  // 粘贴：保留富文本，但消毒；若粘贴的是图片 → 转 dataURL
  editor.addEventListener('paste', async e => {
    const cd = e.clipboardData; if (!cd) return;

    // 1) 如有图片 → 优先处理
    const items = Array.from(cd.items || []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (file) {
        const url = await fileToDataUrl(file);
        insertImage(url);
      }
      return;
    }

    // 2) 富文本 HTML
    const html = cd.getData('text/html');
    if (html) {
      e.preventDefault();
      const cleaned = sanitizeHtml(html);
      try { document.execCommand('insertHTML', false, cleaned); } catch (err) {}
      return;
    }

    // 3) 纯文本 → 用 insertText 保段落
    const text = cd.getData('text/plain');
    if (text) {
      e.preventDefault();
      // 保段落：把 \n\n 转 paragraph break
      try {
        document.execCommand('insertText', false, text);
      } catch (err) {}
    }
  });

  // 编辑器更新 → 字数统计 + 工具栏激活态
  editor.addEventListener('input', updateCharCount);
  editor.addEventListener('keyup', updateToolbarActive);
  editor.addEventListener('mouseup', updateToolbarActive);
  editor.addEventListener('focus', updateToolbarActive);

  function updateCharCount() {
    const text = editor.innerText.replace(/\s+/g, '');
    $('#charCount').textContent = `${text.length} 字`;
  }
  function updateToolbarActive() {
    ['bold', 'italic', 'underline'].forEach(cmd => {
      const btn = toolbar.querySelector(`[data-cmd="${cmd}"]`);
      if (!btn) return;
      try {
        if (document.queryCommandState(cmd)) btn.classList.add('active');
        else btn.classList.remove('active');
      } catch (e) {}
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      // 先压缩大图再转 data URL，大幅减少 base64 字符串长度
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        // 卡片内容区宽度 888px，限制图片最大边 ≤ 1500px 保证清晰度同时控制体积
        const MAX = 1500;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // 回退：原始方式
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      };
      img.src = url;
    });
  }
  function insertImage(dataUrl) {
    editor.focus();
    try {
      document.execCommand('insertImage', false, dataUrl);
    } catch (e) {
      // fallback
      const img = document.createElement('img');
      img.src = dataUrl;
      editor.appendChild(img);
    }
  }

  // 简易 HTML 消毒：保留常见格式标签 + style 中的 color/font-weight
  function sanitizeHtml(html) {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;

    // 移除危险/无关元素
    wrap.querySelectorAll('script, style, link, meta, head, title, iframe, object, embed').forEach(n => n.remove());

    // 把不支持的容器（table, header, footer, etc）转为 div
    wrap.querySelectorAll('table, thead, tbody, tr, td, th, header, footer, nav, aside, section, article, main, form').forEach(n => {
      const div = document.createElement('div');
      div.innerHTML = n.innerHTML;
      n.replaceWith(div);
    });

    // 把外部粘贴的标题（h1-h6）转为 p，统一字号，保留内部加粗/斜体等格式
    wrap.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(n => {
      const p = document.createElement('p');
      p.innerHTML = n.innerHTML;
      n.replaceWith(p);
    });

    // 清理元素属性（仅保留允许的）
    const allowedAttrs = {
      A: ['href'],
      IMG: ['src', 'alt'],
      SPAN: ['style'],
      P: ['style'],
      DIV: ['style'],
      FONT: ['color'],
    };
    wrap.querySelectorAll('*').forEach(n => {
      const ok = allowedAttrs[n.tagName] || [];
      Array.from(n.attributes).forEach(attr => {
        if (!ok.includes(attr.name)) n.removeAttribute(attr.name);
      });
      // 进一步：style 只保留 color / background-color / font-weight / font-style / text-decoration
      if (n.style && n.style.cssText) {
        const keep = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration'];
        const cleaned = keep.filter(p => n.style[p]).map(p => `${p}: ${n.style[p]}`).join('; ');
        n.setAttribute('style', cleaned);
      }
    });

    return wrap.innerHTML;
  }

  // ============ Title / Nickname / settings ============
  titleEl.addEventListener('input', () => state.title = titleEl.value);
  if (tagEl) {
    tagEl.addEventListener('input', () => {
      state.tag = tagEl.value;
      localStorage.setItem('cc.tag', state.tag);
    });
  }
  nickEl.addEventListener('input', () => {
    state.nickname = nickEl.value || '蜡笔不拿笔';
    localStorage.setItem('cc.nickname', state.nickname);
  });
  showPageEl.addEventListener('change', () => state.showPage = showPageEl.checked);
  showNickEl.addEventListener('change', () => state.showNickname = showNickEl.checked);
  autoCoverEl.addEventListener('change', () => state.autoCover = autoCoverEl.checked);

  // ============ Samples ============
  const samples = [
    {
      title: '关于「我丢」',
      html: `<p>我是一个经常丢东西的人。</p>
<p>每次丢完都会反复骂自己——<b>「我怎么这么蠢」「明明可以不丢的」</b>。</p>
<p>后来我发现一个心理学效应：未完成的事会持续占用大脑资源，直到你给它一个"<i>有人管了</i>"的信号。</p>
<p>我做了一个小工具，叫"<b>我丢</b>"。把脑子里悬着的事写下来，交给一只半透明的小猫陪你。</p>
<p>这是我做的第一个产品。</p>`
    },
    {
      title: '今天的小确幸',
      html: `<p>早上去了常去的咖啡店。</p>
<p>老板娘记得我的常点：燕麦拿铁，<b>少糖</b>。</p>
<p>她笑着说："今天看你心情不错。"</p>
<p>我愣了一下——其实我没觉得自己今天有什么特别。</p>
<p>但被这样温柔地看见，<u>心情真的就变好了</u>。</p>`
    },
  ];
  $$('.sample-btn').forEach(b => {
    b.addEventListener('click', () => {
      const s = samples[parseInt(b.dataset.sample, 10)];
      titleEl.value = s.title;
      state.title = s.title;
      editor.innerHTML = s.html;
      updateCharCount();
    });
  });

  // ============ Clear ============
  $('#clearBtn').addEventListener('click', () => {
    if (!editor.innerText.trim() && !state.title) return;
    if (confirm('清空已输入的内容？')) {
      titleEl.value = ''; state.title = '';
      editor.innerHTML = '';
      updateCharCount();
    }
  });

  // ============ Generate ============
  $('#generateBtn').addEventListener('click', () => {
    if (!editor.innerText.trim()) {
      editor.classList.add('shake');
      setTimeout(() => editor.classList.remove('shake'), 500);
      editor.focus();
      return;
    }
    regenerate();
  });
  $('#backToEdit').addEventListener('click', () => {
    $('#previewView').hidden = true;
    $('#editorView').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#downloadAll').addEventListener('click', downloadAll);

  // ============ Render ============
  async function regenerate() {
    deselectImageEl();
    closeColorPopover();
    const list = $('#cardsList');
    list.innerHTML = '<p style="text-align:center;color:#a89e8a;font-style:italic;">正在拼版…</p>';
    state.cards = [];

    $('#editorView').hidden = true;
    $('#previewView').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 等 paint 一次（防止主线程卡）
    await new Promise(r => setTimeout(r, 30));

    const useCover = state.autoCover && state.title.trim();
    const totalOpts = {
      nickname: state.nickname,
      showPage: state.showPage,
      showNickname: state.showNickname,
      tag: state.tag,
      font: state.font,
      fontSize: state.fontSize,
      textColor: state.textColor,
      avatar: state.avatar,
    };

    // 1. 准备拆页输入（如果有标题，把它作为大字 H1 加在最前面，
    //    这样"标题"和"正文开头"会出现在同一张卡上，标题更醒目）
    let workEditor = editor;
    if (useCover) {
      workEditor = editor.cloneNode(true);
      const h1 = document.createElement('h1');
      h1.className = 'cover-title-inline';
      h1.textContent = state.title;
      workEditor.insertBefore(h1, workEditor.firstChild);
    }

    // 2. 拆页
    let pages;
    try {
      pages = window.CARDS.splitIntoPages(workEditor, state.theme, totalOpts);
    } catch (e) {
      console.error('splitIntoPages error:', e);
      list.innerHTML = '<p style="text-align:center;color:#c84b31;">拼版失败：' + e.message + '</p><p style="text-align:center;color:#a89e8a;font-size:13px;">请尝试缩短内容或更换主题</p>';
      return;
    }
    if (!pages || pages.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#a89e8a;">未能生成卡片，请检查内容后重试</p>';
      return;
    }

    // 3. 直接渲染每张内容卡（不再有单独的 cover 页）
    const allItems = pages.map(p => ({ type: 'content', html: p.contentHTML }));

    const total = allItems.length;
    list.innerHTML = '';

    allItems.forEach((item, i) => {
      const opts = { ...totalOpts, pageIndex: i, totalPages: total };
      const card = window.CARDS.makeContentPage(item.html, state.theme, opts);

      // 包装：缩略舞台 + 下载钮
      const stage = document.createElement('div');
      stage.className = 'card-stage';
      stage.appendChild(card);

      const dl = document.createElement('button');
      dl.className = 'card-download';
      dl.title = '保存这张';
      dl.innerHTML = '⬇';
      dl.addEventListener('click', () => downloadOne(card, i));
      stage.appendChild(dl);

      const wrap = document.createElement('div');
      wrap.appendChild(stage);
      const num = document.createElement('div');
      num.className = 'card-num';
      num.textContent = `${i + 1} / ${total}`;
      wrap.appendChild(num);

      list.appendChild(wrap);
      state.cards.push(card);
    });

    $('#previewCount').textContent = `共 ${total} 张`;
  }

  // ============ Download ============
  async function downloadOne(cardEl, i) {
    toast('生成中…');
    try {
      const blob = await window.CARDS.cardToPng(cardEl);
      if (!blob) throw new Error('blob null');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = sanitize(state.title || 'card');
      a.href = url;
      a.download = `${name}-${String(i + 1).padStart(2, '0')}.png`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
      toast('已保存');
    } catch (e) {
      console.error(e);
      toast('保存失败：' + (e.message || ''));
    }
  }

  async function downloadAll() {
    if (!state.cards.length) return;
    toast(`正在生成 ${state.cards.length} 张…`);
    for (let i = 0; i < state.cards.length; i++) {
      await downloadOne(state.cards[i], i);
      await new Promise(r => setTimeout(r, 250));
    }
    toast(`已保存 ${state.cards.length} 张`);
  }

  function sanitize(name) {
    return String(name || 'card').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
  }

  // ============ Toast ============
  let toastTimer;
  function toast(msg, ms = 1800) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

})();
