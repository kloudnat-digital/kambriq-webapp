import { jest } from '@jest/globals';

export const mockQueue = () => ({
  add: jest.fn(() => Promise.resolve({ id: 'job-1' })),
  addBulk: jest.fn(() => Promise.resolve([])),
});
