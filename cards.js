/* ==========================================================
   蜡笔卡 · Canvas 渲染器
   • 5 个主题：信笺 / 暗夜 / 春日 / 炭笔 / 杂志
   • 输出 3:4 (1080×1440) 适配小红书
   • 左上角自动盖印 "蜡笔不拿笔"
   ========================================================== */

window.CARDS = (function () {

  const W = 1080, H = 1440;

  // === 主题定义 ===
  const THEMES = {
    cream: {
      name: '米色信笺',
      bg(c) {
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#fbf6e9');
        g.addColorStop(1, '#f0e8d0');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // 顶部柔光
        const halo = c.createRadialGradient(W * 0.3, 0, 0, W * 0.3, 0, 700);
        halo.addColorStop(0, 'rgba(255,235,180,0.32)');
        halo.addColorStop(1, 'rgba(255,235,180,0)');
        c.fillStyle = halo; c.fillRect(0, 0, W, H);
        // 暗角
        const v = c.createRadialGradient(W/2, H*0.55, H*0.4, W/2, H*0.55, H*0.8);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(60,40,20,0.10)');
        c.fillStyle = v; c.fillRect(0, 0, W, H);
      },
      ink: '#1f1d1a',
      inkSoft: 'rgba(31,29,26,0.55)',
      inkFaint: 'rgba(31,29,26,0.32)',
      accent: '#c84b31',
      tagBg: '#1f1d1a',
      tagFg: '#fbf6e9',
      bodyFont: 'italic 500 44px "Songti SC", "Noto Serif SC", Georgia, serif',
      titleFont: 'italic 700 64px "Songti SC", "Noto Serif SC", Georgia, serif',
      lineHeight: 70,
      titleLineHeight: 90,
      decor(c, isFirst) {
        // 顶部双线
        c.strokeStyle = 'rgba(31,29,26,0.32)';
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(80, 220); c.lineTo(W - 80, 220); c.stroke();
        c.beginPath(); c.moveTo(80, 226); c.lineTo(W - 80, 226); c.stroke();
        // 底部双线
        c.beginPath(); c.moveTo(80, H - 200); c.lineTo(W - 80, H - 200); c.stroke();
        c.beginPath(); c.moveTo(80, H - 206); c.lineTo(W - 80, H - 206); c.stroke();
        // 角落小星
        c.fillStyle = 'rgba(200,75,49,0.5)';
        drawStar(c, 80, 100, 6);
        drawStar(c, W - 80, 100, 6);
      },
    },

    indigo: {
      name: '暗夜诗笺',
      bg(c) {
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1c1838');
        g.addColorStop(0.5, '#14112e');
        g.addColorStop(1, '#0a0820');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // 散落星点
        const stars = [
          [80,100,1.6],[280,160,1],[420,80,1.4],[640,180,1.2],
          [820,120,1.6],[960,260,1],[120,540,1.2],[860,580,1.4],
          [60,800,1],[920,920,1.4],[480,1240,1.2],[180,1320,1],
          [780,1380,1.4],
        ];
        c.fillStyle = '#fff';
        stars.forEach(([x,y,r]) => {
          c.globalAlpha = 0.4 + r * 0.2;
          c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill();
        });
        c.globalAlpha = 1;
      },
      ink: '#f4f0e8',
      inkSoft: 'rgba(244,240,232,0.65)',
      inkFaint: 'rgba(244,240,232,0.38)',
      accent: '#ff8a9c',
      tagBg: 'rgba(255,255,255,0.08)',
      tagFg: '#f4f0e8',
      tagBorder: 'rgba(255,255,255,0.16)',
      bodyFont: '500 44px "Songti SC", "Noto Serif SC", serif',
      titleFont: 'italic 700 64px "Songti SC", "Noto Serif SC", serif',
      lineHeight: 72,
      titleLineHeight: 90,
      decor(c) {
        // 暖光晕
        const halo = c.createRadialGradient(W*0.85, H*0.85, 0, W*0.85, H*0.85, 700);
        halo.addColorStop(0, 'rgba(255,138,156,0.18)');
        halo.addColorStop(1, 'rgba(255,138,156,0)');
        c.fillStyle = halo; c.fillRect(0, 0, W, H);
        // 角落小金星
        c.fillStyle = '#ff8a9c';
        drawStar(c, 100, 100, 6);
        drawStar(c, W - 100, H - 240, 5);
      },
    },

    pastel: {
      name: '春日卡片',
      bg(c) {
        const g = c.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#ffe8e8');
        g.addColorStop(0.5, '#fff5e8');
        g.addColorStop(1, '#e8f0ff');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // 淡色圆斑装饰
        c.globalAlpha = 0.35;
        c.fillStyle = '#ffb8d8';
        c.beginPath(); c.arc(W*0.85, H*0.15, 220, 0, Math.PI*2); c.fill();
        c.fillStyle = '#b8d8f5';
        c.beginPath(); c.arc(W*0.15, H*0.85, 260, 0, Math.PI*2); c.fill();
        c.fillStyle = '#c5e8c5';
        c.beginPath(); c.arc(W*0.5, H*0.5, 180, 0, Math.PI*2); c.fill();
        c.globalAlpha = 1;
      },
      ink: '#3a2840',
      inkSoft: 'rgba(58,40,64,0.65)',
      inkFaint: 'rgba(58,40,64,0.40)',
      accent: '#ff7a9a',
      tagBg: '#fff',
      tagFg: '#3a2840',
      tagBorder: 'rgba(58,40,64,0.18)',
      bodyFont: '500 46px -apple-system, "PingFang SC", sans-serif',
      titleFont: '700 66px -apple-system, "PingFang SC", sans-serif',
      lineHeight: 74,
      titleLineHeight: 92,
      decor(c) {
        // 角落小爱心
        c.fillStyle = '#ff7a9a';
        c.font = 'bold 36px -apple-system, sans-serif';
        c.textAlign = 'right'; c.textBaseline = 'top';
        c.fillText('♡', W - 80, 140);
      },
    },

    charcoal: {
      name: '炭笔速写',
      bg(c) {
        c.fillStyle = '#f5f1e6';
        c.fillRect(0, 0, W, H);
        // 纸张噪点
        for (let i = 0; i < 220; i++) {
          c.globalAlpha = Math.random() * 0.05;
          c.fillStyle = '#000';
          c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }
        c.globalAlpha = 1;
      },
      ink: '#26221d',
      inkSoft: 'rgba(38,34,29,0.62)',
      inkFaint: 'rgba(38,34,29,0.32)',
      accent: '#c64f1f',
      tagBg: '#26221d',
      tagFg: '#f5f1e6',
      bodyFont: '500 44px "Songti SC", "Noto Serif SC", Georgia, serif',
      titleFont: 'italic 700 62px "Songti SC", "Noto Serif SC", Georgia, serif',
      lineHeight: 70,
      titleLineHeight: 88,
      decor(c) {
        // 手画质感的边框（破碎线）
        c.strokeStyle = 'rgba(38,34,29,0.40)';
        c.lineWidth = 2.2;
        c.setLineDash([8, 5, 14, 7]);
        c.strokeRect(46, 46, W - 92, H - 92);
        c.setLineDash([]);
        // 蜡笔色块
        c.fillStyle = '#c64f1f';
        c.globalAlpha = 0.20;
        c.fillRect(W - 220, H - 200, 140, 6);
        c.globalAlpha = 1;
      },
    },

    magazine: {
      name: '杂志大字',
      bg(c) {
        c.fillStyle = '#fafafa';
        c.fillRect(0, 0, W, H);
        // 上下色带
        c.fillStyle = '#1a1a1a';
        c.fillRect(0, 0, W, 12);
        c.fillRect(0, H - 12, W, 12);
      },
      ink: '#1a1a1a',
      inkSoft: 'rgba(26,26,26,0.62)',
      inkFaint: 'rgba(26,26,26,0.30)',
      accent: '#ff4040',
      tagBg: '#1a1a1a',
      tagFg: '#fafafa',
      bodyFont: '600 50px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif',
      titleFont: '900 80px -apple-system, "PingFang SC", "Helvetica Neue", sans-serif',
      lineHeight: 78,
      titleLineHeight: 100,
      decor(c) {
        // 左侧粗红条
        c.fillStyle = '#ff4040';
        c.fillRect(60, 280, 8, H - 480);
      },
    },
  };

  function drawStar(c, cx, cy, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.4;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.fill();
  }

  // 渲染单张卡
  function render(canvas, opts) {
    const {
      text,
      title,           // optional 大字标题（仅第 1 张用）
      pageIndex,
      totalPages,
      themeKey,
      nickname = '蜡笔不拿笔',
      showPage = true,
      showNickname = true,
      isCover = false,
    } = opts;

    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d');
    const t = THEMES[themeKey] || THEMES.cream;

    // 1. 背景
    t.bg(c);

    // 2. 装饰
    if (t.decor) t.decor(c, isCover);

    // 3. 左上角昵称印章
    if (showNickname) {
      drawNicknameTag(c, t, nickname);
    }

    // 4. 主体文字
    drawBody(c, t, text, title, isCover);

    // 5. 右下角页码
    if (showPage && totalPages > 1) {
      c.fillStyle = t.inkFaint;
      c.font = '500 28px "JetBrains Mono", "SF Mono", Menlo, monospace';
      c.textAlign = 'right';
      c.textBaseline = 'bottom';
      c.fillText(`${pageIndex + 1} / ${totalPages}`, W - 90, H - 90);
    }
  }

  // 左上角"蜡笔不拿笔"印章
  function drawNicknameTag(c, t, nickname) {
    const padX = 22, padY = 12, dotR = 7;
    const text = nickname;
    c.font = '600 28px -apple-system, "PingFang SC", sans-serif';
    const tw = c.measureText(text).width;
    const tagW = tw + padX * 2 + dotR * 2 + 12;
    const tagH = 50;
    const x = 80, y = 100;

    // 背景
    if (t.tagBorder) {
      c.fillStyle = t.tagBg;
      c.strokeStyle = t.tagBorder;
      c.lineWidth = 1.5;
      roundedRect(c, x, y, tagW, tagH, 25);
      c.fill();
      c.stroke();
    } else {
      c.fillStyle = t.tagBg;
      roundedRect(c, x, y, tagW, tagH, 25);
      c.fill();
    }

    // 蜡笔色点
    c.fillStyle = t.accent;
    c.beginPath();
    c.arc(x + padX + dotR, y + tagH / 2, dotR, 0, Math.PI * 2);
    c.fill();

    // 昵称文字
    c.fillStyle = t.tagFg;
    c.font = '600 28px -apple-system, "PingFang SC", sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(text, x + padX + dotR * 2 + 12, y + tagH / 2);
  }

  // 主文字渲染
  function drawBody(c, t, text, title, isCover) {
    const padding = 100;
    const maxW = W - padding * 2;
    const startY = isCover ? 480 : 320;
    const endY = H - 240;
    let y = startY;

    c.fillStyle = t.ink;
    c.textAlign = 'left';
    c.textBaseline = 'top';

    // 封面：标题大字
    if (isCover && title) {
      c.font = t.titleFont;
      const titleLines = wrapText(c, title, maxW, 6);
      titleLines.forEach(line => {
        c.fillText(line, padding, y);
        y += t.titleLineHeight;
      });
      y += 24;
      // 装饰短线
      c.strokeStyle = t.accent;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(padding, y); c.lineTo(padding + 80, y);
      c.stroke();
      y += 50;
    }

    // 正文
    c.font = t.bodyFont;
    const paragraphs = String(text || '').split(/\n\n+|\n+/).filter(p => p.trim());
    const allLines = [];
    paragraphs.forEach((p, i) => {
      const lines = wrapText(c, p, maxW, 100);
      lines.forEach(l => allLines.push({ text: l, isParaEnd: false }));
      if (i < paragraphs.length - 1) allLines.push({ text: '', isParaEnd: true });
    });

    // 自适应缩放：如果太长，按比例缩小
    const availableLines = Math.floor((endY - y) / t.lineHeight);
    let lineH = t.lineHeight;
    let font = t.bodyFont;
    if (allLines.length > availableLines) {
      const scale = Math.max(0.65, availableLines / allLines.length);
      lineH = Math.floor(t.lineHeight * scale);
      // 重新缩字号
      font = font.replace(/(\d+)px/, (m, n) => `${Math.floor(parseInt(n) * scale)}px`);
      c.font = font;
    }

    allLines.forEach(({ text, isParaEnd }) => {
      if (isParaEnd) {
        y += lineH * 0.5; return;
      }
      if (y + lineH > endY) return; // 截断
      c.fillText(text, padding, y);
      y += lineH;
    });
  }

  function wrapText(c, text, maxWidth, maxLines) {
    const chars = String(text).split('');
    const lines = [];
    let line = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const test = line + ch;
      // 换行符强制换行
      if (ch === '\n') {
        if (line) lines.push(line);
        line = '';
        if (lines.length >= maxLines) return lines;
        continue;
      }
      if (c.measureText(test).width > maxWidth && line) {
        lines.push(line);
        if (lines.length >= maxLines) return lines;
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  return {
    THEMES,
    render,
    themesList: () => Object.entries(THEMES).map(([k, v]) => ({ key: k, name: v.name })),
  };
})();
