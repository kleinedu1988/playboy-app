"""Referenční hodnoty pro frontend/src/lib/statistika.js (čte frontend/test/statistika.test.js).

Spuštění (potřebuje SciPy, např. ve virtuálním prostředí):
    python3 testdata/statistika-pripady.py > testdata/statistika-pripady.json

Cochranův–Armitageův test SciPy nemá: χ² = N·r², kde r je Pearsonova korelace skóre a výsledku (0/1) přes
jednotlivé modelky – nezávislý výpočet téže statistiky (v R prop.trend.test).
"""
import json

import numpy as np
from scipy import stats

rng = np.random.default_rng(20261108)
pripady = {"normalniChvost": [], "poradi": [], "kendall": [], "cochranArmitage": [], "theilSen": [], "wilson": [],
           "mannWhitney": [], "fisher": [], "bh": []}

for z in [-3.0, -1.0, 0.0, 0.5, 1.0, 1.959963984540054, 2.5, 3.3, 4.0, 4.5, 6.0, 8.0]:
    pripady["normalniChvost"].append({"z": z, "p": float(stats.norm.sf(z))})

for hodnoty in [[3, 1, 2], [1, 1, 1], [5, 3, 3, 9, 1, 3], [2.5, 2.5, 1.0, 7.0, 7.0, 7.0, 0.0]]:
    pripady["poradi"].append({"hodnoty": hodnoty, "poradi": [float(r) for r in stats.rankdata(hodnoty)]})


def kendall(x, y, nazev):
    v = stats.kendalltau(x, y, variant="b", method="asymptotic")
    pripady["kendall"].append({"nazev": nazev, "x": list(map(float, x)), "y": list(map(float, y)),
                               "tau": float(v.statistic), "p": float(v.pvalue)})


kendall([1, 2, 3, 4, 5, 6, 7, 8], [2, 1, 4, 3, 6, 5, 8, 7], "malý bez shod")
kendall([1, 1, 2, 2, 3, 3, 4, 4, 5, 5], [3, 1, 3, 2, 5, 4, 4, 6, 6, 5], "shody v obou")
roky = rng.integers(1960, 2024, 400)
vyska = np.round(165 + 0.08 * (roky - 1960) + rng.normal(0, 5, 400))
kendall(roky, vyska, "roky × výška, slabý trend (400)")
roky = rng.integers(1970, 2020, 300)
kendall(roky, np.round(rng.normal(62, 4, 300)), "roky × pas, bez trendu (300)")
roky = rng.integers(1953, 2025, 1500)
kendall(roky, np.round(rng.normal(24, 3, 1500) - 0.03 * (roky - 1953)), "roky × věk, klesá (1500)")


def ca(skupiny, nazev):
    x = np.concatenate([np.full(s["n"], s["x"]) for s in skupiny])
    y = np.concatenate([np.r_[np.ones(s["ano"]), np.zeros(s["n"] - s["ano"])] for s in skupiny])
    r = stats.pearsonr(x, y).statistic
    chi2 = len(x) * r * r
    pripady["cochranArmitage"].append({"nazev": nazev, "skupiny": skupiny, "z": float(np.sign(r) * np.sqrt(chi2)),
                                       "p": float(stats.chi2.sf(chi2, 1))})


ca([{"x": 1, "n": 20, "ano": 2}, {"x": 2, "n": 25, "ano": 5}, {"x": 3, "n": 30, "ano": 12}], "tři skupiny")
ca([{"x": 1990 + i, "n": int(n), "ano": int(rng.binomial(n, 0.1 + 0.012 * i))}
    for i, n in enumerate(rng.integers(5, 40, 30))], "silikon 1990–2019")
ca([{"x": 1960 + i, "n": int(n), "ano": int(rng.binomial(n, 0.3))}
    for i, n in enumerate(rng.integers(3, 25, 50))], "bez trendu 1960–2009")

for x, y in [([1, 2, 3, 4, 5], [1, 3, 2, 5, 4]), ([1960, 1965, 1970, 1975, 1980, 1985], [168, 169, 168, 171, 172, 172.5]),
             ([1, 1, 2, 3, 3, 4], [5, 6, 4, 3, 3, 1])]:
    pripady["theilSen"].append({"x": x, "y": y, "sklon": float(stats.theilslopes(y, x).slope)})

for ano, n in [(0, 10), (3, 10), (10, 10), (45, 260), (412, 4120), (1, 1)]:
    ci = stats.binomtest(ano, n).proportion_ci(confidence_level=0.95, method="wilson")
    pripady["wilson"].append({"ano": ano, "n": n, "dolni": float(ci.low), "horni": float(ci.high)})

for a, b in [([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]), ([3, 3, 4, 5, 5, 5], [4, 4, 5, 6, 6, 7, 7]),
             (np.round(rng.normal(64, 3, 200)).tolist(), np.round(rng.normal(62, 3, 180)).tolist()),
             (np.round(rng.normal(170, 5, 40)).tolist(), np.round(rng.normal(170, 5, 900)).tolist())]:
    v = stats.mannwhitneyu(a, b, use_continuity=True, alternative="two-sided", method="asymptotic")
    pripady["mannWhitney"].append({"a": list(map(float, a)), "b": list(map(float, b)), "u": float(v.statistic), "p": float(v.pvalue)})

for t in [[[3, 1], [1, 3]], [[10, 2], [3, 15]], [[0, 5], [5, 0]], [[45, 215], [41, 371]], [[120, 280], [300, 500]], [[1, 0], [0, 0]]]:
    pripady["fisher"].append({"tabulka": t, "p": float(stats.fisher_exact(t).pvalue) if sum(map(sum, t)) > 1 else 1.0})

for p in [[0.01, 0.04, 0.03, 0.2], [0.001, 0.5], [0.05]]:
    pripady["bh"].append({"p": p, "q": stats.false_discovery_control(p, method="bh").tolist()})

print(json.dumps(pripady, ensure_ascii=False, indent=1))
