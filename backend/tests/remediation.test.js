import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { profileUpdateSchema } from '../src/modules/auth/auth.schema.js';

describe('Production remediation checks', () => {
  it('requires authentication before exposing sections', async () => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    try {
      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/sections`);
      assert.equal(response.status, 401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects unknown profile fields and enforces password policy', () => {
    assert.throws(
      () => profileUpdateSchema.parse({ role: 'ADMIN' }),
      /Unrecognized key/
    );
    assert.throws(
      () => profileUpdateSchema.parse({ newPassword: 'weakpass' }),
      /uppercase letter/
    );
    assert.deepEqual(
      profileUpdateSchema.parse({ email: 'USER@example.com' }),
      { email: 'user@example.com', phone: null }
    );
  });
});
