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

const EXTRACT_PROMPT = `Извлеки из текста лицензии (или документа об обращении с отходами) следующие данные:
- Название компании (полное наименование организации)
- ИНН (числовой код)
- Полный адрес объекта (адрес размещения/эксплуатации объекта)
- Список кодов ФККО (федеральный классификационный каталог отходов) — массив строк, например ["7 31 100 01 40 4"]

Верни строго один JSON-объект без markdown и без лишнего текста, с ключами на латинице: companyName, inn, address, fkkoCodes (массив строк). Если какого-то поля нет в документе — используй пустую строку или пустой массив.`;

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
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

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
    let json = raw;
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) json = mdMatch[1].trim();
    const parsed = JSON.parse(json);

    const result = {
      companyName: String(parsed.companyName ?? '').trim(),
      inn: String(parsed.inn ?? '').trim(),
      address: String(parsed.address ?? '').trim(),
      fkkoCodes: Array.isArray(parsed.fkkoCodes)
        ? parsed.fkkoCodes.map((c) => String(c).trim()).filter(Boolean)
        : [],
    };

    return res.json(result);
  } catch (err) {
    console.error('analyze-license error:', err);
    if (err instanceof SyntaxError) {
      return res.status(502).json({ message: 'ИИ вернул невалидный JSON' });
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
