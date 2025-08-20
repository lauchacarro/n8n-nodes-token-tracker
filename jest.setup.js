// Jest setup file
global.console = {
  ...console,
  // Silence console.log/warn/error in tests unless explicitly needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
