export async function sha256Hex(input) {
    const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null);
    if (!cryptoObj || !cryptoObj.subtle) {
        throw new Error('Web Crypto API is not disponível para hashing');
    }

    const data = new TextEncoder().encode(input);
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
