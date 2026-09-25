const test = require('node:test');
const assert = require('node:assert/strict');
const { tierForVolume, validateThresholds } = require('./tierService');

test('accepts a positive Bronze minimum when all tier thresholds remain ordered', () => {
  const thresholds = [
    { name: 'Bronze', minimum: 5 },
    { name: 'Silver', minimum: 5000 },
    { name: 'Gold', minimum: 10000 },
    { name: 'Diamond', minimum: 15000 },
  ];

  assert.equal(validateThresholds(thresholds), true);
  assert.equal(tierForVolume(0, thresholds), 'Bronze');
  assert.equal(tierForVolume(5, thresholds), 'Bronze');
});

test('rejects thresholds that are not strictly increasing by tier', () => {
  const thresholds = [
    { name: 'Bronze', minimum: 5 },
    { name: 'Silver', minimum: 5000 },
    { name: 'Gold', minimum: 5000 },
    { name: 'Diamond', minimum: 15000 },
  ];

  assert.equal(validateThresholds(thresholds), false);
});

test('rejects a Gold minimum lower than the Silver minimum', () => {
  const thresholds = [
    { name: 'Bronze', minimum: 5 },
    { name: 'Silver', minimum: 151 },
    { name: 'Gold', minimum: 150 },
    { name: 'Diamond', minimum: 15000 },
  ];

  assert.equal(validateThresholds(thresholds), false);
});