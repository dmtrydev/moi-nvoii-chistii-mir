import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'application/pdf';
    const okExt = file.originalname && file.originalname.toLowerCase().endsWith('.pdf');
    if (okMime && okExt) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только файлы с расширением .pdf'));
    }
  },
});

// VirusTotal API v3 — проверка файла перед обработкой
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VT_BASE = 'https://www.virustotal.com/api/v3';

async function scanFileWithVirusTotal(buffer, filename) {
  if (!VIRUSTOTAL_API_KEY) return { skip: true };
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename || 'document.pdf');
  const uploadRes = await fetch(`${VT_BASE}/files`, {
    method: 'POST',
    headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
    body: form,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`VirusTotal upload: ${uploadRes.status} ${err}`);
  }
  const { data } = await uploadRes.json();
  const analysisId = data?.id;
  if (!analysisId) throw new Error('VirusTotal: no analysis id');

  const maxAttempts = 24;
  const pollMs = 2500;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const analysisRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
      headers: { 'x-apikey': VIRUSTOTAL_API_KEY },
    });
    if (!analysisRes.ok) throw new Error(`VirusTotal analysis: ${analysisRes.status}`);
    const analysisJson = await analysisRes.json();
    const attrs = analysisJson?.data?.attributes;
    const status = attrs?.status;
    if (status === 'completed') {
      const stats = attrs?.stats ?? {};
      const malicious = Number(stats.malicious ?? 0);
      const suspicious = Number(stats.suspicious ?? 0);
      return { malicious, suspicious, clean: malicious === 0 && suspicious === 0 };
    }
    if (status === 'queued' || status === 'in-progress') continue;
    throw new Error(`VirusTotal: unexpected status ${status}`);
  }
  throw new Error('VirusTotal: анализ занял слишком много времени');
}

// Timeweb Cloud AI (OpenAI-совместимый endpoint)
const TIMEWEB_ACCESS_ID = process.env.TIMEWEB_ACCESS_ID;
const TIMEWEB_BEARER_TOKEN = process.env.TIMEWEB_BEARER_TOKEN || TIMEWEB_ACCESS_ID;
const TIMEWEB_BASE = TIMEWEB_ACCESS_ID
  ? `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${TIMEWEB_ACCESS_ID}/v1`
  : null;

// Проверка, что API доступен (для отладки и прокси)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'analyze-license' });
});

const EXTRACT_PROMPT = `Извлеки из текста лицензии (или документа об обращении с отходами) следующие данные. Для КАЖДОГО поля укажи также точную цитату из документа (как она написана в тексте).

Верни строго один JSON-объект без markdown, с ключами на латинице:
- companyName (строка) — полное наименование организации
- companyName_found_text (строка) — дословная цитата из документа для названия
- inn (строка) — ИНН (числовой код)
- inn_found_text (строка) — дословная цитата из документа для ИНН
- address (строка) — полный адрес объекта
- address_found_text (строка) — дословная цитата из документа для адреса
- fkkoCodes (массив строк) — коды ФККО, например ["7 31 100 01 40 4"]
- fkkoCodes_found_text (строка) — дословная цитата из документа, где перечислены коды ФККО (одна строка)

Если какого-то поля нет в документе — используй пустую строку или пустой массив. *_found_text должны быть подстроками исходного текста документа.`;

async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text ?? '';
  } finally {
    await parser.destroy();
  }
}

app.post('/api/analyze-license', upload.single('file'), async (req, res) => {
  let rawContent = '';
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    // Проверка на вирусы временно отключена. Чтобы включить — раскомментируйте блок ниже и задайте VIRUSTOTAL_API_KEY.
    // try {
    //   const vtResult = await scanFileWithVirusTotal(file.buffer, file.originalname);
    //   if (!vtResult.skip && !vtResult.clean) {
    //     return res.status(422).json({
    //       message: 'Файл не прошёл проверку безопасности. Загрузите другой PDF-документ.',
    //     });
    //   }
    // } catch (scanErr) {
    //   console.error('VirusTotal scan error:', scanErr);
    //   return res.status(500).json({
    //     message: 'Не удалось проверить файл. Попробуйте другой документ.',
    //   });
    // }

    const text = await extractTextFromPdf(file.buffer);
    if (!text || text.trim().length < 50) {
      return res.status(400).json({
        message: 'Не удалось извлечь текст из PDF или документ слишком короткий',
      });
    }

    if (!TIMEWEB_BASE) {
      return res.status(503).json({
        message: 'Сервис анализа не настроен. Укажите TIMEWEB_ACCESS_ID.',
      });
    }

    const chatRes = await fetch(`${TIMEWEB_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TIMEWEB_BEARER_TOKEN}`,
        'x-proxy-source': process.env.TIMEWEB_PROXY_SOURCE || '',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'Ты извлекаешь структурированные данные из текста лицензии. Отвечай только валидным JSON.',
          },
          {
            role: 'user',
            content: `${EXTRACT_PROMPT}\n\nТекст документа:\n\n${text.slice(0, 12000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error('Timeweb API error:', chatRes.status, errText);
      return res.status(502).json({
        message: `Ошибка ИИ (${chatRes.status}). Проверьте TIMEWEB_ACCESS_ID и доступ к Timeweb Cloud AI.`,
      });
    }

    const completion = await chatRes.json();
    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    rawContent = raw;
    let json = raw;
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) json = mdMatch[1].trim();
    else {
      const first = raw.indexOf('{');
      const last = raw.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) json = raw.slice(first, last + 1);
    }
    // Убираем trailing commas (частая ошибка ИИ)
    json = json.replace(/,(\s*[}\]])/g, '$1');
    const parsed = JSON.parse(json);

    const result = {
      companyName: String(parsed.companyName ?? '').trim(),
      inn: String(parsed.inn ?? '').trim(),
      address: String(parsed.address ?? '').trim(),
      fkkoCodes: Array.isArray(parsed.fkkoCodes)
        ? parsed.fkkoCodes.map((c) => String(c).trim()).filter(Boolean)
        : [],
      foundTexts: {
        companyName: String(parsed.companyName_found_text ?? '').trim(),
        inn: String(parsed.inn_found_text ?? '').trim(),
        address: String(parsed.address_found_text ?? '').trim(),
        fkkoCodes: String(parsed.fkkoCodes_found_text ?? '').trim(),
      },
    };

    return res.json(result);
  } catch (err) {
    console.error('analyze-license error:', err);
    if (err instanceof SyntaxError) {
      if (rawContent) console.error('ИИ ответ (сырой):', rawContent.slice(0, 1500));
      return res.status(502).json({ message: 'ИИ вернул невалидный JSON. Попробуйте загрузить файл ещё раз.' });
    }
    return res
      .status(500)
      .json({ message: err.message || 'Ошибка при анализе лицензии' });
  }
});

// На деплое: раздаём собранный фронт (одна ссылка для заказчика)
const distRoot = path.join(process.cwd(), 'dist');
const distFromServer = path.join(__dirname, '..', 'dist');
const distPath = existsSync(distRoot) ? distRoot : existsSync(distFromServer) ? distFromServer : null;
if (distPath) {
  app.use(express.static(distPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

function startServer(tryPort) {
  const server = app.listen(tryPort, () => {
    console.log(`API: http://localhost:${tryPort}`);
    if (tryPort !== port) {
      console.log(`(порт ${port} был занят, использован ${tryPort})`);
      console.log(`В .env укажите: VITE_API_URL=http://localhost:${tryPort}`);
    }
    if (!TIMEWEB_ACCESS_ID) {
      console.warn('TIMEWEB_ACCESS_ID не задан — анализ лицензий через Timeweb недоступен.');
    }
    if (!VIRUSTOTAL_API_KEY) {
      console.warn('VIRUSTOTAL_API_KEY не задан — проверка файлов на вирусы отключена.');
    }
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && tryPort < 3010) {
      console.warn(`Порт ${tryPort} занят, пробуем ${tryPort + 1}...`);
      startServer(tryPort + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

startServer(port);
