import test from 'node:test';
import assert from 'node:assert/strict';
import { timeActivityLabels, summarizeTimeEntries } from '../src/features/timeTracking/model.js';

test('selectable activities place threading before installation and omit legacy technician', () => {
  const keys = Object.keys(timeActivityLabels);
  assert.ok(keys.indexOf('threading') < keys.indexOf('installation'));
  assert.equal(keys.includes('technician'), false);
  assert.equal(timeActivityLabels.general, 'עבודה כללית');
});

test('legacy technician hours remain counted once alongside general work', () => {
  const entries = [{ activity_type: 'technician', hours: '2.5' }, { activity_type: 'general', hours: 1 }, { activity_type: 'threading', hours: '0.75' }];
  const totals = summarizeTimeEntries(entries);
  assert.equal(totals.find(item => item.key === 'general').hours, 3.5);
  assert.equal(totals.reduce((sum, item) => sum + item.hours, 0), 4.25);
  assert.equal(entries[0].activity_type, 'technician');
  assert.ok(summarizeTimeEntries().every(item => item.hours === 0));
});
