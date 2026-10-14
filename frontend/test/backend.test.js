import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Každé volání backendu musí jít přes app/backend.js, jinak by zápis nezneplatnil mezipaměti pohledů
test('backend.js obaluje všechna volání backendu', () => {
    const app = fs.readFileSync(new URL('../wailsjs/go/main/App.js', import.meta.url), 'utf8');
    const obal = fs.readFileSync(new URL('../src/app/backend.js', import.meta.url), 'utf8');
    const volani = [...app.matchAll(/export function (\w+)/g)].map(m => m[1]);
    const chybi = volani.filter(v => !obal.includes(`export const ${v} = /** @type {typeof App.${v}} */ (obalit('${v}'));`));
    assert.deepEqual(chybi, []);
});

test('moduly rozhraní volají backend jen přes backend.js', () => {
    const slozka = new URL('../src/app/', import.meta.url);
    const prime = fs.readdirSync(slozka).filter(f => f !== 'backend.js' && fs.readFileSync(new URL(f, slozka), 'utf8').includes('wailsjs/go/main/App'));
    assert.deepEqual(prime, []);
    assert.ok(!fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').includes('wailsjs/go/main/App'));
});
