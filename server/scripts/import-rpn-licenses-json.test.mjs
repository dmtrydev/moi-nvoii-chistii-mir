import assert from 'node:assert/strict';
import test from 'node:test';
import { mapRegistryEntryToSites } from './import-rpn-licenses-json.js';

const baseOrg = {
  shortName: 'ООО Тест',
  inn: '7707083893',
  registrationAddress: { unrecognizablePart: 'г. Москва' },
};

const baseWasteRow = {
  piking: true,
  wasteTypes: {
    wasteKode: '10101010101',
    name: 'Тестовый отход',
    klassOpasnosti: '4',
  },
};

test('mapRegistryEntryToSites: без number — не null', () => {
  const entry = {
    subject: { data: { organization: baseOrg } },
    licensingActivityRegistryWasteRPN: {
      objects: [
        {
          address: { fullAddress: 'г. Москва, ул. Тестовая, д. 1' },
          xsdData: { WasteActivityTypes: [baseWasteRow] },
        },
      ],
    },
  };
  const out = mapRegistryEntryToSites(entry);
  assert.ok(out);
  assert.equal(out.innNorm, '7707083893');
  assert.equal(out.sites.length, 1);
});

test('mapRegistryEntryToSites: c number — номер не сохраняется в payload', () => {
  const entry = {
    number: '  ABC-777  ',
    subject: { data: { organization: baseOrg } },
    licensingActivityRegistryWasteRPN: {
      objects: [
        {
          address: { fullAddress: 'г. Москва, ул. Тестовая, д. 1' },
          xsdData: { WasteActivityTypes: [baseWasteRow] },
        },
      ],
    },
  };
  const out = mapRegistryEntryToSites(entry);
  assert.ok(out);
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'externalRef'), false);
});

test('mapRegistryEntryToSites: сохраняет статус реестра и перевод', () => {
  const entry = {
    status: 'annulled',
    subject: { data: { organization: baseOrg } },
    licensingActivityRegistryWasteRPN: {
      objects: [
        {
          address: { fullAddress: 'г. Москва, ул. Тестовая, д. 1' },
          xsdData: { WasteActivityTypes: [baseWasteRow] },
        },
      ],
    },
  };
  const out = mapRegistryEntryToSites(entry);
  assert.ok(out);
  assert.equal(out.registryStatus, 'annulled');
  assert.equal(out.registryStatusRu, 'Аннулирована');
  assert.equal(out.registryInactive, true);
});

test('mapRegistryEntryToSites: подставляет заглушки при пустых полях', () => {
  const entry = {
    _id: 'abc123',
    status: 'paused',
    subject: { data: { organization: { shortName: '', inn: '' } } },
    licensingActivityRegistryWasteRPN: { objects: [] },
  };
  const out = mapRegistryEntryToSites(entry);
  assert.ok(out);
  assert.equal(out.inn, null);
  assert.equal(out.innNorm, null);
  assert.match(out.companyName, /Неизвестная организация/);
  assert.equal(out.primaryAddr, 'Адрес не указан (импорт РПН)');
  assert.equal(out.sites.length, 1);
});
