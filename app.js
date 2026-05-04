/* ==========================================================
   蜡笔卡 · 主程序
   ========================================================== */

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // —— 状态 ——
  const state = {
    text: '',
    title: '',
    nickname: localStorage.getItem('cc.nickname') || '蜡笔不拿笔',
    theme: localStorage.getItem('cc.theme') || 'cream',
    charLimit: parseInt(localStorage.getItem('cc.charLimit') || '220', 10),
    showPage: true,
    showNickname: true,
    autoCover: true, // 第一句作为标题
    cards: [],
  };

  // ============ Wire UI ============
  const inputEl = $('#textInput');
  const titleEl = $('#titleInput');
  const nickEl = $('#nicknameInput');
  const charLimitEl = $('#charLimit');
  const charLimitNum = $('#charLimitNum');
  const showPageEl = $('#showPage');
  const showNickEl = $('#showNickname');
  const autoCoverEl = $('#autoCover');

  // 初始化值
  nickEl.value = state.nickname;
  charLimitEl.value = state.charLimit;
  charLimitNum.textContent = state.charLimit;
  showPageEl.checked = true;
  showNickEl.checked = true;
  autoCoverEl.checked = true;

  // 主题渲染
  const themeWrap = $('#themePicker');
  themeWrap.innerHTML = window.CARDS.themesList().map(t => `
    <button class="theme-btn ${t.key === state.theme ? 'active' : ''}" data-theme="${t.key}">
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
      if (state.cards.length) regenerate();
    });
  });

  // 输入实时统计
  inputEl.addEventListener('input', () => {
    state.text = inputEl.value;
    $('#charCount').textContent = `${state.text.length} 字 · 预计 ${estimateCardCount()} 张`;
  });
  titleEl.addEventListener('input', () => state.title = titleEl.value);
  nickEl.addEventListener('input', () => {
    state.nickname = nickEl.value || '蜡笔不拿笔';
    localStorage.setItem('cc.nickname', state.nickname);
  });
  charLimitEl.addEventListener('input', () => {
    state.charLimit = parseInt(charLimitEl.value, 10);
    charLimitNum.textContent = state.charLimit;
    localStorage.setItem('cc.charLimit', String(state.charLimit));
    $('#charCount').textContent = `${state.text.length} 字 · 预计 ${estimateCardCount()} 张`;
  });
  showPageEl.addEventListener('change', () => state.showPage = showPageEl.checked);
  showNickEl.addEventListener('change', () => state.showNickname = showNickEl.checked);
  autoCoverEl.addEventListener('change', () => state.autoCover = autoCoverEl.checked);

  // 一些示例
  const samples = [
    {
      title: '关于"我丢"',
      text: `我是一个经常丢东西的人。

每次丢完都会反复骂自己——「我怎么这么蠢」「明明可以不丢的」。

后来我发现一个心理学效应：未完成的事会持续占用大脑资源，直到你给它一个"有人管了"的信号。

我做了一个小工具，叫"我丢"。把脑子里悬着的事写下来，交给一只半透明的小猫陪你。

这是我做的第一个产品。`
    },
    {
      title: '今天的小确幸',
      text: `早上去了常去的咖啡店。

老板娘记得我的常点：燕麦拿铁，少糖。

她笑着说："今天看你心情不错。"

我愣了一下——其实我没觉得自己今天有什么特别。

但被这样温柔地看见，心情真的就变好了。`
    },
  ];
  $$('.sample-btn').forEach((b, i) => {
    b.addEventListener('click', () => {
      const s = samples[i];
      titleEl.value = s.title;
      inputEl.value = s.text;
      state.title = s.title;
      state.text = s.text;
      $('#charCount').textContent = `${state.text.length} 字 · 预计 ${estimateCardCount()} 张`;
    });
  });

  // 清空
  $('#clearBtn').addEventListener('click', () => {
    if (!state.text && !state.title) return;
    if (confirm('清空已输入的内容？')) {
      titleEl.value = ''; inputEl.value = '';
      state.title = ''; state.text = '';
      $('#charCount').textContent = '0 字';
    }
  });

  // 生成
  $('#generateBtn').addEventListener('click', () => {
    if (!state.text.trim()) {
      shake(inputEl);
      return;
    }
    regenerate();
  });

  // 重新编辑
  $('#backToEdit').addEventListener('click', () => {
    $('#previewView').hidden = true;
    $('#editorView').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 全部保存
  $('#downloadAll').addEventListener('click', () => downloadAll());

  // ============ 文本拆分 ============
  function splitText(text, charLimit) {
    // 1. 段落级拆分（保留段落结构）
    const paragraphs = text.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
    const cards = [];
    let buf = []; let bufLen = 0;

    function flush() {
      if (buf.length) { cards.push(buf.join('\n\n')); buf = []; bufLen = 0; }
    }

    for (const p of paragraphs) {
      // 段落本身就超长 → 按句号拆
      if (p.length > charLimit) {
        flush();
        const sents = p.split(/(?<=[。！？.!?])\s*/);
        let sBuf = ''; let sLen = 0;
        for (const s of sents) {
          if (sLen + s.length > charLimit && sBuf) {
            cards.push(sBuf);
            sBuf = s; sLen = s.length;
          } else {
            sBuf += s; sLen += s.length;
          }
        }
        if (sBuf) cards.push(sBuf);
        continue;
      }
      // 累加段落
      if (bufLen + p.length > charLimit && buf.length) {
        flush();
      }
      buf.push(p);
      bufLen += p.length + 2; // +2 for \n\n
    }
    flush();
    return cards;
  }

  function estimateCardCount() {
    if (!state.text) return 0;
    return Math.max(1, splitText(state.text, state.charLimit).length);
  }

  // ============ 生成 + 渲染 ============
  function regenerate() {
    const chunks = splitText(state.text, state.charLimit);
    const list = $('#cardsList');
    list.innerHTML = '';
    state.cards = [];

    // 第一张如果是"封面"，title 放上面，正文放下面（且字数允许）
    const useCover = state.autoCover && state.title.trim();

    chunks.forEach((chunk, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'card-wrap';
      const cv = document.createElement('canvas');
      cv.className = 'card-canvas';
      const dl = document.createElement('button');
      dl.className = 'card-download';
      dl.title = '保存这张';
      dl.innerHTML = '⬇';
      dl.addEventListener('click', () => downloadOne(cv, i));
      wrap.appendChild(cv);
      wrap.appendChild(dl);

      const num = document.createElement('div');
      num.className = 'card-num';
      num.textContent = `${i + 1} / ${chunks.length}`;
      wrap.appendChild(num);

      list.appendChild(wrap);

      window.CARDS.render(cv, {
        text: chunk,
        title: i === 0 ? state.title : '',
        pageIndex: i,
        totalPages: chunks.length,
        themeKey: state.theme,
        nickname: state.nickname,
        showPage: state.showPage,
        showNickname: state.showNickname,
        isCover: i === 0 && useCover,
      });

      state.cards.push(cv);
    });

    $('#editorView').hidden = true;
    $('#previewView').hidden = false;
    $('#previewCount').textContent = `共 ${chunks.length} 张`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============ 下载 ============
  function downloadOne(canvas, i) {
    canvas.toBlob(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      const name = state.title || 'card';
      a.href = url;
      a.download = `${sanitize(name)}-${String(i + 1).padStart(2, '0')}.png`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    }, 'image/png', 0.95);
  }

  async function downloadAll() {
    if (!state.cards.length) return;
    // 顺序下载（避免触发浏览器拦截）
    for (let i = 0; i < state.cards.length; i++) {
      downloadOne(state.cards[i], i);
      await new Promise(r => setTimeout(r, 300));
    }
    toast(`已开始下载 ${state.cards.length} 张`);
  }

  function sanitize(name) {
    return String(name || 'card').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
  }

  // ============ 工具 ============
  function shake(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  }
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

})();
