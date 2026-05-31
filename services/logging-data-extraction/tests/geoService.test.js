'use strict';

const assert = require('assert');
const { fromGeoipLite, formatCity, hasValidCoords } = require('../services/geoService');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`, err.message);
    process.exitCode = 1;
  }
}

test('Hong Kong IP resolves from geoip-lite without city field', () => {
  const geo = fromGeoipLite('203.198.23.1');
  assert.ok(geo, 'expected geo result');
  assert.ok(geo.city.toLowerCase().includes('hong kong'), `city=${geo.city}`);
  assert.strictEqual(geo.countryCode, 'HK');
  assert.ok(hasValidCoords(geo.lat, geo.lng), 'expected coordinates');
  assert.strictEqual(geo.precision, 'country');
});

test('formatCity keeps city-state labels', () => {
  assert.strictEqual(formatCity('Central', '', 'Hong Kong'), 'Central, Hong Kong');
  assert.strictEqual(formatCity('', '', 'Hong Kong'), 'Hong Kong');
});

test('hasValidCoords rejects 0,0', () => {
  assert.strictEqual(hasValidCoords(0, 0), false);
  assert.strictEqual(hasValidCoords(22.25, 114.16), true);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('All geoService tests passed.');
