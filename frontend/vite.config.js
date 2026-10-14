import { defineConfig } from 'vite';

// Rozhraní vkládá CHANGELOG.md z kořene repozitáře (okno „Co je nového“); vývojový server ho musí smět číst
export default defineConfig({
    server: { fs: { allow: ['..'] } },
});
