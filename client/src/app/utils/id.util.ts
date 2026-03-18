const BYTE_RANGE = 256;
const HEX_RADIX = 16;
const UUID_SECTION_BYTES = {
    first: 4,
    middle: 2,
    last: 6,
} as const;

function randomHexSegment(length: number): string {
    const buffer = new Uint8Array(length);
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.getRandomValues) {
        cryptoApi.getRandomValues(buffer);
    } else {
        for (let index = 0; index < length; index++) {
            buffer[index] = Math.floor(Math.random() * BYTE_RANGE);
        }
    }

    return Array.from(buffer, (value) => value.toString(HEX_RADIX).padStart(UUID_SECTION_BYTES.middle, '0')).join('');
}

export function generateClientId(): string {
    const cryptoApi = globalThis.crypto as Crypto | undefined;

    if (cryptoApi?.randomUUID) {
        return cryptoApi.randomUUID();
    }

    return [
        randomHexSegment(UUID_SECTION_BYTES.first),
        randomHexSegment(UUID_SECTION_BYTES.middle),
        randomHexSegment(UUID_SECTION_BYTES.middle),
        randomHexSegment(UUID_SECTION_BYTES.middle),
        randomHexSegment(UUID_SECTION_BYTES.last),
    ].join('-');
}
