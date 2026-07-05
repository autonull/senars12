import {TextDecoder, TextEncoder} from 'util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

const setupBrowserMocks = () => {
    if (typeof window !== 'undefined') {
        window.URL = window.URL || {};
        window.URL.createObjectURL = window.URL.createObjectURL || function () {
            return 'mock-url';
        };
        window.URL.revokeObjectURL = window.URL.revokeObjectURL || function () {
        };
    }
    if (typeof global !== 'undefined') {
        global.window = global.window || {
            URL: {
                createObjectURL: function () {
                    return 'mock-url';
                },
                revokeObjectURL: function () {
                }
            }
        };
        global.URL = global.URL || {
            createObjectURL: function () {
                return 'mock-url';
            },
            revokeObjectURL: function () {
            }
        };
    }
};

setupBrowserMocks();
