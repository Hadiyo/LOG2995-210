export function resolveAssetUrl(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    return new URL(normalizedPath, document.baseURI).toString();
}

