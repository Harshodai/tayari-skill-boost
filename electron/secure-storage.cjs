const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const STORE_FILE = 'tayari-secure-storage.json';
const KEY_FILE = 'tayari-secure-storage.key';

function paths() {
  const dir = app.getPath('userData');
  return { store: path.join(dir, STORE_FILE), key: path.join(dir, KEY_FILE) };
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, JSON.stringify(value), { mode: 0o600 });
}
async function fallbackKey(file) {
  try { return await fs.readFile(file); } catch {
    const key = crypto.randomBytes(32);
    await fs.writeFile(file, key, { mode: 0o600 });
    return key;
  }
}
function encryptFallback(key, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') };
}
function decryptFallback(key, record) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.data, 'base64')), decipher.final()]).toString('utf8');
}
function createSecureStorage() {
  const useSafeStorage = () => Boolean(safeStorage?.isEncryptionAvailable?.());
  return {
    async get(key) {
      if (!key) throw new Error('Secure-storage key is required.');
      const { store, key: keyFile } = paths();
      const records = await readJson(store, {});
      if (!records[key]) return null;
      if (useSafeStorage()) return safeStorage.decryptString(Buffer.from(records[key], 'base64'));
      return decryptFallback(await fallbackKey(keyFile), records[key]);
    },
    async set(key, value) {
      if (!key || typeof value !== 'string') throw new Error('Secure-storage key and string value are required.');
      const { store, key: keyFile } = paths();
      const records = await readJson(store, {});
      records[key] = useSafeStorage()
        ? safeStorage.encryptString(value).toString('base64')
        : encryptFallback(await fallbackKey(keyFile), value);
      await writeJson(store, records);
      return true;
    },
    async delete(key) {
      const { store } = paths();
      const records = await readJson(store, {});
      delete records[key];
      await writeJson(store, records);
      return true;
    },
    async clearAll() {
      const { store, key: keyFile } = paths();
      await Promise.all([fs.rm(store, { force: true }), fs.rm(keyFile, { force: true })]);
      return true;
    },
  };
}
module.exports = { createSecureStorage };
