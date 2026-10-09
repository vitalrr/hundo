import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const forge = require('node-forge');
const braces = require('braces');

test('patched node-forge rejects unexpected nested DigestAlgorithm children', () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const digest = forge.md.sha256.create().update('hundo security regression').digest().bytes();
  const asn1 = forge.asn1;
  const value = (type: number, constructed: boolean, contents: unknown) =>
    asn1.create(asn1.Class.UNIVERSAL, type, constructed, contents);
  const oid = value(asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes());
  const nullValue = value(asn1.Type.NULL, false, '');
  const makeSignature = (algorithmChildren: unknown[]) => {
    const algorithm = value(asn1.Type.SEQUENCE, true, algorithmChildren);
    const info = value(asn1.Type.SEQUENCE, true, [algorithm, value(asn1.Type.OCTETSTRING, false, digest)]);
    return forge.pki.rsa.encrypt(asn1.toDer(info).getBytes(), keys.privateKey, 0x01);
  };

  assert.equal(keys.publicKey.verify(digest, makeSignature([oid, nullValue])), true);
  assert.throws(
    () => keys.publicKey.verify(digest, makeSignature([
      oid, nullValue, value(asn1.Type.OCTETSTRING, false, 'unexpected child')
    ])),
    /valid RSASSA-PKCS1-v1_5 DigestInfo/
  );
});

test('patched braces bounds nesting without changing ordinary patterns', () => {
  assert.deepEqual(braces('{a,b}'), ['(a|b)']);
  assert.deepEqual(braces.expand('{a,b}'), ['a', 'b']);
  const deepPattern = '{,'.repeat(3000) + 'z' + '}'.repeat(3000);
  assert.throws(() => braces(deepPattern), /Brace nesting exceeds safe depth/);
  assert.throws(() => braces.expand(deepPattern), /Brace nesting exceeds safe depth/);
});
