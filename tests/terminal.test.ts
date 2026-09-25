import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTerminalDate,isInvalidTerminalMessage} from '../lib/terminal';

test('revoked or invalid terminal code triggers a reconnect',()=>{
  assert.equal(isInvalidTerminalMessage('Terminal kodi noto‘g‘ri yoki bekor qilingan'),true);
  assert.equal(isInvalidTerminalMessage('Terminal kodi noto‘g‘ri'),true);
  assert.equal(isInvalidTerminalMessage('Terminal tasdiqlanmagan'),true);
});
test('temporary connection problems must not erase a valid terminal token',()=>{
  assert.equal(isInvalidTerminalMessage('Aloqa xatosi'),false);
  assert.equal(isInvalidTerminalMessage('Too many requests'),false);
  assert.equal(isInvalidTerminalMessage('Hozir faol dars yo‘q'),false);
});
test('phone header date uses Uzbek month and Tashkent time',()=>{
  assert.equal(formatTerminalDate(new Date('2026-09-25T18:03:00Z')),'25 sentabr 2026');
});
