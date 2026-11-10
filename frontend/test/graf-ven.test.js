import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csv, nazevSouboru } from '../src/lib/graf-ven.js';

test('CSV pro český Excel', () => {
    assert.equal(csv([['Rok', 'Výška'], [1975, 170.5], ['a;b', 'řekl "ne"'], [null, NaN]]),
        '﻿Rok;Výška\r\n1975;170,5\r\n"a;b";"řekl ""ne"""\r\n;\r\n');
});

test('název souboru grafu', () => {
    assert.equal(nazevSouboru('Výška · medián', 'png'), 'vyska-median.png');
    assert.equal(nazevSouboru('', 'csv'), 'graf.csv');
});
