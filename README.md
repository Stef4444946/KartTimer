# KartTime Reader 2.0

Chrome-extensie voor Apex Timing die automatisch kartnummers en beste zichtbare rondetijden leest, heats opslaat en een blijvende kart-ranking maakt.

## Ranking
De ranking gebruikt niet alleen één absolute snelste ronde. Per kart wordt per opgeslagen heat de beste gereden tijd bewaard. Daarna wordt berekend:

- **Gemiddelde:** gemiddelde van de beste tijd uit iedere heat waarin de kart is geregistreerd.
- **Beste:** snelste tijd ooit.
- **Ranking score:** 70% gemiddelde + 30% beste tijd.

Hierdoor staat een kart die heel vaak constant snel is normaal gesproken hoger dan een kart met één extreem snelle uitschieter.

## Automatisch opslaan
Zolang de Apex live-timing open staat leest de extensie ongeveer iedere seconde. Wanneer de herkende heat/sessie verandert, wordt de vorige live-heat als opgeslagen heat afgesloten. De karttijden worden permanent opgeslagen in Chrome storage.

## Installeren
1. Pak de ZIP uit.
2. Ga naar `chrome://extensions`.
3. Zet Ontwikkelaarsmodus aan.
4. Kies Uitgepakte extensie laden.
5. Selecteer de map `KartTimeReader`.
6. Open de extensie.
7. Plak bijvoorbeeld `https://live.apex-timing.com/kartbaanoldenzaal/`.
8. Klik op Open live timing.

## Tabbladen
- LIVE: huidige Apex-heat.
- KART RANKING: gemiddelde, beste tijd en aantal heats.
- HEATS: automatisch opgeslagen heats.

Let op: de heat wordt afgesloten zodra Apex een andere sessie/heatnaam zichtbaar maakt. De pagina moet dus open blijven tijdens de live timing.
