# Karta kwalifikacyjna – mapowanie na formularz (Dz.U. 2026 poz. 704)

Źródło: `docs/dz-u-2026-poz-704.pdf`, załącznik nr 6 do rozporządzenia MEN z 27.05.2026 (wzór karty), strony 3–5.

| Punkt karty | Treść wzoru | Pole w systemie | Kto wypełnia |
| --- | --- | --- | --- |
| I.1 | forma wypoczynku (zaznaczyć X) | stała: „półkolonia” | system |
| I.2 | termin wypoczynku od–do | `Turnus.startDate` / `endDate` | system |
| I.3 | adres wypoczynku | `Turnus.venue` | system |
| I.3 | trasa wędrowna, kraj | nie dotyczy (puste) | — |
| I | miejscowość, data; podpis organizatora | seed organizatora (miasto, pieczątka) | system |
| II.1 | imię (imiona) i nazwisko uczestnika | `childFirstName`, `childLastName` | rodzic |
| II.2 | imiona i nazwiska rodziców | `parentFirstName/LastName`, `secondParentName` | rodzic |
| II.3 | rok urodzenia | z PESEL (`birthDate`) | system |
| II.4 | numer PESEL (11 pól) | `peselEnc` (szyfrowany) | rodzic |
| II.5 | adres zamieszkania uczestnika | `childAddress` lub adres rodziców (`childSameAddress`) | rodzic |
| II.6 | adres zamieszkania lub pobytu rodziców (dla niepełnoletniego) | `parentAddress`, `parentPostalCode`, `parentCity` | rodzic |
| II.7 | telefony rodziców dostępne w czasie wypoczynku | `parentPhone`, `parentPhoneAlt` | rodzic |
| II.8 | specjalne potrzeby edukacyjne | `healthEnc.specialNeeds` | rodzic |
| II.9 | zdrowie, rozwój, dieta, szczepienia | `healthEnc` (uczulenia, choroba lokomocyjna, leki, choroby przewlekłe, aparat/okulary, dieta, emocje, lęk wysokości, hydrofobia, inne, szczepienia) | rodzic |
| II, podpis | podpis rodziców / pełnoletniego uczestnika | podpis (etap 2: ścieżka podpisu) | rodzic |
| III | decyzja: zakwalifikować / odmówić, uzasadnienie, data, podpis organizatora | `Application.decision` (etap 2, panel biura) | biuro |
| IV–VI | potwierdzenie pobytu, stan zdrowia, spostrzeżenia kadry | poza zakresem (papier, wypełnia kadra) | kadra |

## Zgodność ze specyfikacją

- Numeracja II.1–II.9 i treść punktów zgodne ze specyfikacją (sekcja „Zmiany w umowie i karcie”).
- Punkt II.9 obejmuje: uczulenia, chorobę lokomocyjną, leki z dawkami, choroby przewlekłe, aparat/okulary/soczewki, dietę (w tym wegetarianizm), problemy z emocjami i funkcjonowaniem w grupie, lęk wysokości, hydrofobię oraz szczepienia (tężec, błonica, inne z rokiem lub książeczka). Formularz zbiera te same informacje.
- Podpis „rodziców / pełnoletniego uczestnika” – zgodnie ze specyfikacją.
- Część III: wzór ma dwie opcje („zakwalifikować i skierować” / „odmówić skierowania ze względu na…”). Specyfikacja opisuje „Kwalifikuję” / „Odmawiam z uzasadnieniem”. To to samo, zgodnie z wzorem.

## Do potwierdzenia

- Wzór w PDF mówi w § 3, że rozporządzenie wchodzi w życie po upływie 7 dni od ogłoszenia. Specyfikacja podaje datę 6 czerwca 2026. Tekst PDF nie zawiera daty ogłoszenia, więc tej daty nie da się stąd potwierdzić.
