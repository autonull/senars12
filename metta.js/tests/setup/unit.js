import { TextDecoder, TextEncoder } from 'util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

const setupBrowserMocks = () => {
  if (typeof window !== 'undefined') {
    window.URL = window.URL || {};
    window.URL.createObjectURL = window.URL.createObjectURL || (() => 'mock-url');
    window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});
  }
  if (typeof global !== 'undefined') {
    global.window = global.window || {
      URL: {
        createObjectURL: () => 'mock-url',
        revokeObjectURL: () => {},
      },
    };
    global.URL = global.URL || {
      createObjectURL: () => 'mock-url',
      revokeObjectURL: () => {},
    };
  }
};

setupBrowserMocks();
