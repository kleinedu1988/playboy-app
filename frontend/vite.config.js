import { defineConfig } from 'vite';

// Rozhraní vkládá CHANGELOG.md z kořene repozitáře (okno „Co je nového“); vývojový server ho musí smět číst
export default defineConfig({
    server: { fs: { allow: ['..'] } },
    // Program běží z disku, jeden balík ~750 kB (s editorem textu CodeMirror) nevadí
    build: { chunkSizeWarningLimit: 1000 },
});
