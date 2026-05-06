import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGroroCardHtml, parseGroroObjectRaw, fetchGroroObjectById } from '../groroParser.js';
import { enrichFromRusprofile } from '../rusprofileEnrich.js';

test('parseGroroCardHtml: extracts card fields and wastes', () => {
  const html = `
    <html><head><title>Полигон тестовый</title></head><body>
      <table>
        <tr><td>Регион ОРО</td><td>Алтайский край</td></tr>
        <tr><td>Номер объекта</td><td>22-00004-З-00479-010814</td></tr>
        <tr><td>Статус</td><td>Действующий</td></tr>
        <tr><td>Наименование</td><td>ООО Экотест</td></tr>
        <tr><td>ИНН</td><td>7707083893</td></tr>
        <tr><td>Юридический адрес</td><td>г. Барнаул, ул. Тестовая, 1</td></tr>
      </table>
      <h2>Размещаемые отходы</h2>
      <table>
        <tr><th>ФККО 2017</th><th>ФККО 2002</th><th>Наименование</th></tr>
        <tr><td>7 33 100 01 72 4</td><td></td><td>мусор офисный</td></tr>
      </table>
    </body></html>
  `;
  const out = parseGroroCardHtml(html);
  assert.equal(out.groroNumber, '22-00004-З-00479-010814');
  assert.equal(out.registryStatus, 'active');
  assert.equal(out.operatorInn, '7707083893');
  assert.equal(out.wastes.length, 1);
  assert.equal(out.wastes[0].fkkoCode, '73310001724');
});

test('enrichFromRusprofile: parses fallback inn and address', async () => {
  const fakeFetch = async () => ({
    ok: true,
    text: async () => '<html><body>ИНН: 5263000000 Юридический адрес: г. Дзержинск, пр-кт Свердлова, д.4 ОГРН 123</body></html>',
  });
  const out = await enrichFromRusprofile(
    { queryName: 'Тест', fallbackAddress: 'г. Дзержинск, пр-кт Свердлова, д.4' },
    fakeFetch,
  );
  assert.equal(out.innNorm, '5263000000');
  assert.match(out.legalAddress, /Дзержинск/);
});

test('parseGroroObjectRaw: parses tilde response format', () => {
  const raw =
    'Склад ила~Алтайский край (50)~22-00001-Х-00479-010814~Действующий~Хранение~Отсутствует~~~~~' +
    '~~https://airsoft-bit.ru/prikazi-groro/406~ОАО «ВОДОКАНАЛ»~4633001577~г. Белокуриха~~~&~94300000000~~Отходы осадки*';
  const out = parseGroroObjectRaw(raw, 2724000);
  assert.ok(out);
  assert.equal(out.sourceObjectId, '2724000');
  assert.equal(out.groroNumber, '22-00001-Х-00479-010814');
  assert.equal(out.registryStatus, 'active');
  assert.equal(out.operatorInn, '4633001577');
  assert.equal(out.wastes.length, 1);
  assert.equal(out.wastes[0].fkkoCode, '94300000000');
});

test('fetchGroroObjectById: sends expected POST params', async () => {
  const fakeFetch = async (_url, init) => {
    const body = String(init?.body ?? '');
    assert.match(body, /function=getObjectItem/);
    assert.match(body, /idObject=2724000/);
    return {
      ok: true,
      text: async () =>
        'Склад ила~Алтайский край (50)~22-00001-Х-00479-010814~Действующий~~~~~~~~~~ОАО «ВОДОКАНАЛ»~4633001577~г. Белокуриха~~~&~94300000000~~Отходы*',
    };
  };
  const out = await fetchGroroObjectById(2724000, fakeFetch);
  assert.equal(out.groroNumber, '22-00001-Х-00479-010814');
});

