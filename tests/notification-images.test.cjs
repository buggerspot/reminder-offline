const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('notification attachments preserve the original image across repeat scheduling and tolerate missing files', async () => {
  const original = 'file:///documents/reminder-images/photo.png';
  const files = new Map([[original, 'image-bytes']]);
  globalThis.__imageFileSystem = {
    cacheDirectory: 'file:///cache/',
    getInfoAsync: async uri => ({ exists: files.has(uri) }),
    makeDirectoryAsync: async () => {},
    copyAsync: async ({ from, to }) => {
      if (!files.has(from)) throw new Error('Missing file');
      files.set(to, files.get(from));
    },
    deleteAsync: async uri => { files.delete(uri); },
  };
  try {
    const source = fs.readFileSync('src/lib/images.js', 'utf8')
      .replace('import * as DocumentPicker from "expo-document-picker";', 'const DocumentPicker = {};')
      .replace('import * as FileSystem from "expo-file-system/legacy";', 'const FileSystem = globalThis.__imageFileSystem;');
    const { notificationImageAttachments } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const [first] = await notificationImageAttachments(original);
    assert.notEqual(first.url, original);
    assert.equal(first.hideThumbnail, false);
    assert.equal(files.get(first.url), 'image-bytes');
    // Model iOS consuming the disposable notification attachment.
    files.delete(first.url);
    const [second] = await notificationImageAttachments(original);
    assert.equal(files.get(second.url), 'image-bytes');
    assert.equal(files.get(original), 'image-bytes');
    assert.deepEqual(await notificationImageAttachments('file:///missing.png'), []);
    assert.deepEqual(await notificationImageAttachments(null), []);
    assert.deepEqual(await notificationImageAttachments('file:///unsupported.svg'), []);
  } finally {
    delete globalThis.__imageFileSystem;
  }
});
