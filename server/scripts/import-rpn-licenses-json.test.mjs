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

test('mapRegistryEntryToSites: без number — не null, externalRef null', () => {
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
  assert.equal(out.externalRef, null);
  assert.equal(out.innNorm, '7707083893');
  assert.equal(out.sites.length, 1);
});

test('mapRegistryEntryToSites: с number — externalRef как в JSON', () => {
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
  assert.equal(out.externalRef, 'ABC-777');
});
