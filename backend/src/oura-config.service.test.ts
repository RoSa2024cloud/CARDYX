import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderOuraConfig } from './oura-config.service';

const token = 'a'.repeat(64);
const firstAddress = `addr1${'q'.repeat(48)}`;
const secondAddress = `addr1${'p'.repeat(48)}`;

test('Oura config deduplicates and deterministically filters current registry patterns', () => {
  const config = renderOuraConfig({ poolPatterns: [firstAddress, secondAddress, firstAddress], webhookToken: token });
  assert.ok(config.indexOf(secondAddress) < config.indexOf(firstAddress));
  assert.equal(config.split(firstAddress).length - 1, 1);
  assert.match(config, /type = "Redis"[\s\S]*flush_interval = 1/);
  assert.match(config, /type = "WebHook"[\s\S]*dismissible = false/);
  assert.match(config, new RegExp(`authorization = "Bearer ${token}"`));
});

test('Oura config fails closed for empty address sets, invalid addresses, or weak tokens', () => {
  assert.throws(() => renderOuraConfig({ poolPatterns: [], webhookToken: token }));
  assert.throws(() => renderOuraConfig({ poolPatterns: ['not-an-address'], webhookToken: token }));
  assert.throws(() => renderOuraConfig({ poolPatterns: [firstAddress], webhookToken: 'weak' }));
});

test('Oura filters legacy Byron pools by their native asset fingerprints', () => {
  const fingerprint = 'asset17gru2ykh588q9vcx9al2nnmt72wzyxv3gct3ya';
  const config = renderOuraConfig({ poolPatterns: [fingerprint], webhookToken: token });
  assert.ok(config.includes(fingerprint));
});