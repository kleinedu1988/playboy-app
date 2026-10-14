// Kostra okna a prvky stránky, které používá víc modulů
import { SABLONA_OKNA } from '../sablona';
import { pripravitOznameni } from '../ui/oznameni';
import { pripravitNabidku } from '../ui/nabidka';

document.querySelector('#app').innerHTML = SABLONA_OKNA;
pripravitOznameni();
pripravitNabidku();

// Elementy
export const gallery = document.getElementById('gallery');
export const detailView = document.getElementById('detailView');
export const searchInput = document.getElementById('searchInput');
export const backBtn = document.getElementById('backBtn');
export const wall = document.getElementById('wall');
export const covers = document.getElementById('covers');
export const coversList = document.getElementById('coversList');
export const calList = document.getElementById('calList');
export const issueView = document.getElementById('issueView');
export const calendar = document.getElementById('calendar');
export const stats = document.getElementById('stats');
export const best = document.getElementById('best');