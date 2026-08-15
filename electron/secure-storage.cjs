const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const STORE_FILE = 'tayari-secure-storage.json';
const LEGACY_KEY_FILE = 'tayari-secure-storage.key';

function paths() {
  const dir = app.getPath('userData');
  return { store: path.join(dir, STORE_FILE), legacyKey: path.join(dir, LEGACY_KEY_FILE) };
}
function assertAvailable() {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error('OS-backed secure storage is unavailable. Job Tayari will not persist session secrets on this device.');
  }
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  await fs.chmod(temporary, 0o600);
  await fs.rename(temporary, file);
  await fs.chmod(file, 0o600);
}
function createSecureStorage() {
  return {
    async get(key) {
      if (!key) throw new Error('Secure-storage key is required.');
      const { store } = paths();
      const records = await readJson(store, {});
      if (!records[key]) return null;
      assertAvailable();
      return safeStorage.decryptString(Buffer.from(records[key], 'base64'));
    },
    async set(key, value) {
      if (!key || typeof value !== 'string' || value.length > 512000) throw new Error('Secure-storage key and bounded string value are required.');
      assertAvailable();
      const { store } = paths();
      const records = await readJson(store, {});
      records[key] = safeStorage.encryptString(value).toString('base64');
      await writeJson(store, records);
      return true;
    },
    async delete(key) {
      if (!key) throw new Error('Secure-storage key is required.');
      const { store } = paths();
      const records = await readJson(store, {});
      delete records[key];
      await writeJson(store, records);
      return true;
    },
    async clearAll() {
      const { store, legacyKey } = paths();
      await Promise.all([fs.rm(store, { force: true }), fs.rm(legacyKey, { force: true })]);
      return true;
    },
  };
}
module.exports = { createSecureStorage };
