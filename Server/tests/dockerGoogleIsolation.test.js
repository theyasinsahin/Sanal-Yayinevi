import { jest } from '@jest/globals';
import { OAuth2Client } from 'google-auth-library';
import { authenticateWithGoogleCredential } from '../src/services/userService.js';

test('disabled Docker Google integration rejects before contacting Google', async () => {
  const original = { ...process.env };
  const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
  try {
    process.env.BETIK_DOCKER_DEV = 'true';
    process.env.DEV_EXTERNAL_INTEGRATIONS = 'false';
    await expect(authenticateWithGoogleCredential('synthetic-unused-token')).rejects.toThrow('kapalı');
    expect(verify).not.toHaveBeenCalled();
  } finally {
    process.env = original;
    verify.mockRestore();
  }
});
