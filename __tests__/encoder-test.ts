jest.dontMock('../src/index.ts');

import earl from '../src';

describe('packs', () => {
    it('an object', () => {
        const packed = earl.pack({ a: 1 });
        const expected = new Uint8Array([
            131, 116, 0, 0, 0, 1, 109, 0, 0, 0, 1, 97, 97, 1,
        ]);

        expect(packed).toEqual(expected);
    });
});
