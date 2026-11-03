import { jest } from '@jest/globals';
import * as mockHtmlparser2 from 'htmlparser2';

// sanitize-html 2.18 uses Node 22's require(ESM) interoperability. Jest 29's VM
// loader lacks it: expose the REAL ESM parser exports to its CJS loader. Neither
// parsing nor sanitization is stubbed; hostile input uses the actual library.
jest.doMock('htmlparser2', () => mockHtmlparser2);
