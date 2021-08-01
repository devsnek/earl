import Encoder from './encoder';
import Decoder from './decoder';

export default {
    pack: (data: any) => {
        const encoder = new Encoder();

        encoder.pack(data);

        return encoder.buffer.slice(0, encoder.offset);
    },
    unpack: (buffer: Iterable<number>, { bigintToString = false } = {}) => {
        const decoder = new Decoder(buffer, bigintToString);
        
        return decoder.unpack();
    },
};
