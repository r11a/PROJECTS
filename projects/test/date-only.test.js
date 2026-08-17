import assert from 'node:assert/strict';
import test from 'node:test';
import { installPostgresDateOnlyParser, normalizeDateOnly, POSTGRES_DATE_OID } from '../server/dateOnly.js';

test('calendar dates are never converted through a timezone', () => {
  let installedOid;
  let installedParser;
  installPostgresDateOnlyParser({
    setTypeParser(oid, parser) {
      installedOid = oid;
      installedParser = parser;
    },
  });

  assert.equal(installedOid, POSTGRES_DATE_OID);
  assert.equal(installedParser('2026-08-18'), '2026-08-18');
  assert.equal(normalizeDateOnly('2026-08-18'), '2026-08-18');
  assert.equal(normalizeDateOnly('2026-08-20'), '2026-08-20');
});

test('invalid or timezone-bearing task dates are rejected at the API boundary', () => {
  assert.equal(normalizeDateOnly('2026-02-30'), null);
  assert.equal(normalizeDateOnly('2026-08-18T00:00:00.000Z'), null);
  assert.equal(normalizeDateOnly('17/08/2026'), null);
  assert.equal(normalizeDateOnly(''), null);
});
