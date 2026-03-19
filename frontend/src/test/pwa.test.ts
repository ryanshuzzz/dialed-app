import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('PWA manifest', () => {
  const manifestPath = resolve(__dirname, '../../public/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  it('has the app name "Dialed"', () => {
    expect(manifest.name).toBe('Dialed');
  });

  it('has a short_name', () => {
    expect(manifest.short_name).toBeTruthy();
  });

  it('has a start_url', () => {
    expect(manifest.start_url).toBe('/');
  });

  it('has display set to standalone', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('has a theme_color', () => {
    expect(manifest.theme_color).toBeTruthy();
  });

  it('has a background_color', () => {
    expect(manifest.background_color).toBeTruthy();
  });

  it('has icons with 192x192 and 512x512 sizes', () => {
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('icons have type image/png', () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
    }
  });
});

describe('Service worker registration', () => {
  it('main.tsx contains service worker registration code', () => {
    const mainPath = resolve(__dirname, '../main.tsx');
    const mainContent = readFileSync(mainPath, 'utf-8');
    expect(mainContent).toContain('serviceWorker');
    expect(mainContent).toContain('register');
  });
});
