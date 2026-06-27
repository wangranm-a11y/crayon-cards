#!/usr/bin/env node

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const defaults = {
  title: '',
  html: '',
  theme: 'charcoal',
  nickname: '蜡笔不拿笔',
  tag: '',
  font: 'huiwen',
  fontSize: '44',
  textColor: 'default',
  avatar: 'icons/avatar.png',
  huiwenFont: '',
  showPage: true,
  showNickname: true,
  autoCover: true,
  outputDir: path.resolve(process.cwd(), 'crayon-output'),
  filenamePrefix: '',
  json: false,
};

main().catch(err => {
  console.error(`crayon-cards: ${err.message}`);
  process.exit(1);
});

async function main() {
  const opts = await readOptions(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  if (!stripHtml(opts.html).trim()) {
    throw new Error('请通过 --text、--html、--input 或 JSON 配置提供正文内容');
  }

  const puppeteer = loadPuppeteer();
  if (opts.font === 'huiwen' && !opts.huiwenFont) {
    opts.huiwenFont = findHuiwenFont();
  }
  if (opts.font === 'huiwen' && !opts.huiwenFont) {
    throw new Error('缺少汇文明朝字体文件。请安装 @fontpkg/huiwen-mincho，或传入 --huiwen-font /path/to/Huiwen-mincho.otf');
  }
  await mkdir(opts.outputDir, { recursive: true });

  const server = await startStaticServer(rootDir, { huiwenFontPath: opts.huiwenFont });
  opts.huiwenFontUrl = server.huiwenFontUrl;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: findChromeExecutable(),
      defaultViewport: { width: 1280, height: 1800, deviceScaleFactor: 1 },
      args: ['--allow-file-access-from-files', '--disable-web-security'],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(`${server.url}/index.html`, { waitUntil: 'networkidle0' });

    const result = await page.evaluate(async (options) => {
      const editor = document.querySelector('#editor');
      if (!editor || !window.CARDS) {
        throw new Error('页面未正确加载卡片编辑器');
      }

      if (options.font === 'huiwen' && options.huiwenFontUrl) {
        const style = document.createElement('style');
        style.textContent = `
          @font-face {
            font-family: 'Huiwen-mincho';
            src: url('${options.huiwenFontUrl}') format('opentype');
            font-weight: 400 900;
            font-style: normal;
            font-display: block;
          }
        `;
        document.head.appendChild(style);
      }

      editor.innerHTML = options.html;
      const fontProbe = `${options.title || ''} ${String(editor.innerText || editor.textContent || '')}`.replace(/\s+/g, ' ').trim();
      if (options.font === 'huiwen' && document.fonts) {
        await document.fonts.load('44px "Huiwen-mincho"', fontProbe || '汇文明朝');
        await document.fonts.load('100px "Huiwen-mincho"', fontProbe || '汇文明朝');
        await document.fonts.ready;
      }

      const workEditor = editor.cloneNode(true);
      if (options.autoCover && options.title.trim()) {
        const h1 = document.createElement('h1');
        h1.className = 'cover-title-inline';
        h1.textContent = options.title;
        workEditor.insertBefore(h1, workEditor.firstChild);
      }

      const totalOpts = {
        nickname: options.nickname,
        showPage: options.showPage,
        showNickname: options.showNickname,
        tag: options.tag,
        font: options.font,
        fontSize: options.fontSize,
        textColor: options.textColor,
        avatar: options.avatar,
      };

      const pages = window.CARDS.splitIntoPages(workEditor, options.theme, totalOpts);
      const cards = pages.map((item, i) => window.CARDS.makeContentPage(item.contentHTML, options.theme, {
        ...totalOpts,
        pageIndex: i,
        totalPages: pages.length,
      }));

      const out = [];
      for (let i = 0; i < cards.length; i += 1) {
        document.body.appendChild(cards[i]);
        const blob = await window.CARDS.cardToPng(cards[i]);
        if (!blob) throw new Error(`第 ${i + 1} 张卡片导出失败`);
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error(`第 ${i + 1} 张卡片读取失败`));
          reader.readAsDataURL(blob);
        });
        cards[i].remove();
        out.push(dataUrl);
      }

      return {
        width: window.CARDS.W,
        height: window.CARDS.H,
        count: out.length,
        images: out,
      };
    }, opts);

    const prefix = opts.filenamePrefix || sanitizeFilename(opts.title || 'card');
    const files = [];
    for (let i = 0; i < result.images.length; i += 1) {
      const base64 = result.images[i].replace(/^data:image\/png;base64,/, '');
      const file = path.join(opts.outputDir, `${prefix}-${String(i + 1).padStart(2, '0')}.png`);
      await writeFile(file, Buffer.from(base64, 'base64'));
      files.push(file);
    }

    const payload = {
      ok: true,
      count: files.length,
      width: result.width,
      height: result.height,
      theme: opts.theme,
      font: opts.font,
      huiwenFont: opts.font === 'huiwen' ? opts.huiwenFont : undefined,
      files,
    };

    if (opts.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`生成 ${files.length} 张卡片：`);
      files.forEach(file => console.log(file));
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

async function readOptions(argv) {
  const cli = parseArgs(argv);
  if (cli.help) return { ...defaults, help: true };

  let fileOptions = {};
  if (cli.config) {
    fileOptions = JSON.parse(await readFile(path.resolve(cli.config), 'utf8'));
  }

  let inputContent = '';
  if (cli.input) {
    inputContent = await readFile(path.resolve(cli.input), 'utf8');
  }

  const text = normalizeText(cli.text || fileOptions.text || '');
  const html = cli.html || fileOptions.html || inputContent;

  return {
    ...defaults,
    ...fileOptions,
    ...cli,
    html: cli.html || fileOptions.html ? html : textToHtml(text || html),
    fontSize: String(cli.fontSize || fileOptions.fontSize || defaults.fontSize),
    outputDir: path.resolve(cli.outputDir || fileOptions.outputDir || defaults.outputDir),
    filenamePrefix: sanitizeFilename(cli.filenamePrefix || fileOptions.filenamePrefix || ''),
    showPage: resolveBool(cli.showPage, fileOptions.showPage, defaults.showPage),
    showNickname: resolveBool(cli.showNickname, fileOptions.showNickname, defaults.showNickname),
    autoCover: resolveBool(cli.autoCover, fileOptions.autoCover, defaults.autoCover),
    huiwenFont: resolveOptionalPath(cli.huiwenFont || fileOptions.huiwenFont || defaults.huiwenFont),
    json: Boolean(cli.json || fileOptions.json),
  };
}

function parseArgs(argv) {
  const out = {};
  const keyMap = {
    'font-size': 'fontSize',
    'text-color': 'textColor',
    'output-dir': 'outputDir',
    'filename-prefix': 'filenamePrefix',
    'huiwen-font': 'huiwenFont',
    'show-page': 'showPage',
    'show-nickname': 'showNickname',
    'auto-cover': 'autoCover',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.help = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`未知参数：${arg}`);
    }

    if (arg.startsWith('--no-')) {
      const key = keyMap[arg.slice(5)] || toCamel(arg.slice(5));
      out[key] = false;
      continue;
    }

    const eq = arg.indexOf('=');
    const rawKey = arg.slice(2, eq === -1 ? undefined : eq);
    const key = keyMap[rawKey] || toCamel(rawKey);
    const next = eq === -1 ? argv[i + 1] : arg.slice(eq + 1);

    if (['json'].includes(key)) {
      out[key] = true;
      continue;
    }
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    if (eq === -1) i += 1;
  }
  return out;
}

function loadPuppeteer() {
  const candidates = [
    'puppeteer',
    path.join(process.env.HOME || '', '.local/node/lib/node_modules/puppeteer'),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_) {}
  }
  throw new Error('缺少 puppeteer。请在项目目录运行：npm install');
}

function findChromeExecutable() {
  if (process.env.CRAYON_CHROME_PATH) return process.env.CRAYON_CHROME_PATH;

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  return candidates.find(candidate => existsSync(candidate));
}

function findHuiwenFont() {
  const candidates = [
    process.env.CRAYON_HUIWEN_FONT,
    '/tmp/crayon-cards/Huiwen-mincho.otf',
    '/tmp/node_modules/@fontpkg/huiwen-mincho/Huiwen-mincho.otf',
    path.join(process.cwd(), 'node_modules/@fontpkg/huiwen-mincho/Huiwen-mincho.otf'),
    path.join(rootDir, 'node_modules/@fontpkg/huiwen-mincho/Huiwen-mincho.otf'),
    path.join(process.cwd(), 'fonts/Huiwen-mincho.otf'),
    path.join(rootDir, 'fonts/Huiwen-mincho.otf'),
  ].filter(Boolean);

  return candidates.find(candidate => existsSync(candidate)) || '';
}

function textToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function normalizeText(text) {
  return String(text || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function sanitizeFilename(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 40);
}

function resolveBool(primary, secondary, fallback) {
  if (typeof primary === 'boolean') return primary;
  if (typeof secondary === 'boolean') return secondary;
  return fallback;
}

function resolveOptionalPath(value) {
  return value ? path.resolve(value) : '';
}

function toCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function startStaticServer(baseDir, opts = {}) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.otf': 'font/otf',
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    if (pathname === '/__crayon-fonts/Huiwen-mincho.otf' && opts.huiwenFontPath && existsSync(opts.huiwenFontPath)) {
      res.writeHead(200, {
        'Content-Type': 'font/otf',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      createReadStream(opts.huiwenFontPath).pipe(res);
      return;
    }
    const filePath = path.resolve(baseDir, `.${pathname}`);
    if (!filePath.startsWith(baseDir) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    huiwenFontUrl: opts.huiwenFontPath ? `http://127.0.0.1:${address.port}/__crayon-fonts/Huiwen-mincho.otf` : '',
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

function printHelp() {
  console.log(`crayon-cards - 从命令行生成蜡笔卡 PNG

用法：
  crayon-cards --title "标题" --text "正文" --output-dir ./out
  crayon-cards --config card.json --json

常用参数：
  --title <text>             标题，会作为封面大字混排到第 1 张
  --text <text>              纯文本正文，空行会转成段落
  --html <html>              富文本正文 HTML
  --input <file>             从文本文件读取正文
  --config <file>            从 JSON 读取完整配置
  --theme <key>              cream, indigo, charcoal, minimal, neon, editorial, violet, noir，默认 charcoal
  --nickname <text>          左上角昵称
  --tag <text>               左下角标签
  --font <key>               default, serif, sans, handwrite, xique, huiwen，默认 huiwen
  --huiwen-font <file>       指定汇文明朝 OTF，默认自动查找 @fontpkg/huiwen-mincho
  --font-size <px>           正文字号，默认 44
  --text-color <color>       正文字色，默认 default
  --output-dir <dir>         输出目录，默认 ./crayon-output
  --filename-prefix <name>   输出文件名前缀
  --no-show-page             不显示页码
  --no-show-nickname         不显示昵称
  --no-auto-cover            不把标题混排进第一张
  --json                     输出机器可读 JSON
`);
}
