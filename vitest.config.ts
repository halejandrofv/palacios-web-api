import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./src/modules/_shared', import.meta.url)) },
  },
  plugins: [
    {
      name: 'worker-data-modules',
      enforce: 'pre',
      async load(id): Promise<string | undefined> {
        if (!/\.(png|webp)$/.test(id)) return;
        const data = await readFile(id, 'base64');
        return `import { Buffer } from "node:buffer"; export default Uint8Array.from(Buffer.from(${JSON.stringify(data)}, "base64")).buffer;`;
      },
    },
  ],
  test: { include: ['test/**/*.{spec,test}.ts'] },
});
