import { concat, md5, rc4, sameBytes } from './md5';
import { Dict, Name, nameOf, numberOf, type PdfValue } from './syntax';

/**
 * The PDF standard security handler (ISO 32000-2 §7.6.4): checks the password to open a
 * document and decrypts its streams. RC4 (revisions 2–3), AES-128 (4) and AES-256 (5–6),
 * with AES and SHA-2 from the browser's WebCrypto. The password lives only in this call.
 */
export type Decrypt = (data: Uint8Array, num: number, gen: number) => Promise<Uint8Array>;
export type Subtle = Pick<SubtleCrypto, 'importKey' | 'encrypt' | 'decrypt' | 'digest'>;

export class UnsupportedEncryption extends Error {}

const PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);
const bytesOf = (value: PdfValue | undefined) =>
  value instanceof Uint8Array ? value : new Uint8Array();
const le32 = (n: number) =>
  Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);

async function aes(
  subtle: Subtle,
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  encrypt: boolean,
) {
  // Copies: WebCrypto takes plain ArrayBuffer-backed views.
  const handle = await subtle.importKey('raw', key.slice(), 'AES-CBC', false, [
    encrypt ? 'encrypt' : 'decrypt',
  ]);
  const params = { name: 'AES-CBC', iv: iv.slice() };
  const input = data.slice();
  return new Uint8Array(
    encrypt
      ? await subtle.encrypt(params, handle, input)
      : await subtle.decrypt(params, handle, input),
  );
}

/** AES-CBC decryption of whole blocks without padding (WebCrypto insists on padding). */
async function aesNoPad(subtle: Subtle, key: Uint8Array, iv: Uint8Array, data: Uint8Array) {
  const last = data.subarray(data.length - 16);
  const padBlock = (await aes(subtle, key, last, new Uint8Array(), true)).subarray(0, 16);
  return aes(subtle, key, iv, concat(data, padBlock), false);
}

/** Algorithm 2.B (revision 6): the hash that checks a password and unwraps the key. */
async function hash6(subtle: Subtle, password: Uint8Array, salt: Uint8Array, extra: Uint8Array) {
  let k = new Uint8Array(await subtle.digest('SHA-256', concat(password, salt, extra)));
  for (let round = 0; ; round += 1) {
    const block = concat(password, k, extra);
    const k1 = new Uint8Array(block.length * 64);
    for (let i = 0; i < 64; i += 1) k1.set(block, i * block.length);
    const e = (await aes(subtle, k.subarray(0, 16), k.subarray(16, 32), k1, true)).subarray(
      0,
      k1.length,
    );
    const mod = e.subarray(0, 16).reduce((total, value) => total + value, 0) % 3;
    k = new Uint8Array(await subtle.digest(['SHA-256', 'SHA-384', 'SHA-512'][mod], e));
    if (round >= 63 && e[e.length - 1] <= round - 31) return k.subarray(0, 32);
  }
}

async function key56(subtle: Subtle, encrypt: Dict, password: string, revision: number) {
  const pass = new TextEncoder().encode(password).subarray(0, 127);
  const u = bytesOf(encrypt.get('U'));
  const check = (salt: Uint8Array) =>
    revision === 6
      ? hash6(subtle, pass, salt, new Uint8Array())
      : subtle.digest('SHA-256', concat(pass, salt)).then((buffer) => new Uint8Array(buffer));
  if (!sameBytes(await check(u.subarray(32, 40)), u.subarray(0, 32))) return null;
  const wrap = await check(u.subarray(40, 48));
  return aesNoPad(subtle, wrap, new Uint8Array(16), bytesOf(encrypt.get('UE')));
}

function key24(encrypt: Dict, password: string, id: Uint8Array, revision: number) {
  const length = revision === 2 ? 5 : (numberOf(encrypt.get('Length')) ?? 40) / 8;
  const pass = Uint8Array.from(password.slice(0, 32), (char) => char.charCodeAt(0) & 0xff);
  const metadata = encrypt.get('EncryptMetadata') !== false || revision < 4;
  let key = md5(
    concat(
      concat(pass, PAD).subarray(0, 32),
      bytesOf(encrypt.get('O')),
      le32(numberOf(encrypt.get('P')) ?? 0),
      id,
      metadata ? new Uint8Array() : Uint8Array.from([255, 255, 255, 255]),
    ),
  ).subarray(0, length);
  if (revision >= 3) for (let i = 0; i < 50; i += 1) key = md5(key).subarray(0, length);
  const u = bytesOf(encrypt.get('U'));
  let check: Uint8Array;
  if (revision === 2) check = rc4(key, PAD);
  else {
    check = rc4(key, md5(concat(PAD, id)));
    for (let i = 1; i <= 19; i += 1)
      check = rc4(
        key.map((value) => value ^ i),
        check,
      );
  }
  const width = revision === 2 ? 32 : 16;
  return sameBytes(check.subarray(0, width), u.subarray(0, width)) ? key : null;
}

/** The stream cipher named by the crypt filters: 'rc4', 'aes128', 'aes256' or none. */
function streamCipher(encrypt: Dict, version: number) {
  if (version < 4) return 'rc4';
  const name = nameOf(encrypt.get('StmF')) ?? 'Identity';
  if (name === 'Identity') return 'none';
  const filters = encrypt.get('CF');
  const filter = filters instanceof Dict ? filters.get(name) : undefined;
  const method = filter instanceof Dict ? nameOf(filter.get('CFM')) : null;
  if (method === 'AESV2') return 'aes128';
  if (method === 'AESV3') return 'aes256';
  if (method === 'V2') return 'rc4';
  if (method === 'None') return 'none';
  throw new UnsupportedEncryption(String(method));
}

/** Stream decryption for `password`, or null when the password is wrong. */
export async function openEncryption(
  encrypt: Dict,
  id: Uint8Array,
  password: string,
  subtle: Subtle | undefined,
): Promise<Decrypt | null> {
  const filter = encrypt.get('Filter');
  const version = numberOf(encrypt.get('V')) ?? 0;
  const revision = numberOf(encrypt.get('R')) ?? 0;
  if (!(filter instanceof Name) || filter.name !== 'Standard' || revision < 2 || revision > 6) {
    throw new UnsupportedEncryption('handler');
  }
  const cipher = streamCipher(encrypt, version);
  if ((cipher !== 'rc4' || revision >= 5) && !subtle) throw new UnsupportedEncryption('crypto');
  const key =
    revision >= 5
      ? await key56(subtle!, encrypt, password, revision)
      : key24(encrypt, password, id, revision);
  if (!key) return null;
  return async (data, num, gen) => {
    if (cipher === 'none') return data;
    if (cipher === 'aes256')
      return aes(subtle!, key, data.subarray(0, 16), data.subarray(16), false);
    const salt = cipher === 'aes128' ? Uint8Array.from([0x73, 0x41, 0x6c, 0x54]) : new Uint8Array();
    const objectKey = md5(
      concat(
        key,
        Uint8Array.from([num, num >> 8, num >> 16, gen, gen >> 8].map((b) => b & 0xff)),
        salt,
      ),
    ).subarray(0, Math.min(key.length + 5, 16));
    if (cipher === 'rc4') return rc4(objectKey, data);
    return aes(subtle!, objectKey, data.subarray(0, 16), data.subarray(16), false);
  };
}
