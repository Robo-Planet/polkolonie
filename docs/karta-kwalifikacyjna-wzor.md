<!--
Szablon karty kwalifikacyjnej uczestnika wypoczynku dla systemu półkolonii RoboPlanet.
Treść odtworzona z wzoru stanowiącego załącznik do rozporządzenia Ministra Edukacji
z dnia 27 maja 2026 r. (Dz. U. 2026 poz. 704), obowiązującego od 6.06.2026.
Oryginał: https://dziennikustaw.gov.pl/DU/2026/704 (str. 3–5).
Przed użyciem porównać z oryginałem: układ i brzmienie muszą odpowiadać wzorowi.

Oznaczenia:
  {{pole}}      wartość wstawiana przez system
  [X] / [ ]     pole wyboru zaznaczone / niezaznaczone
  (pusto)       miejsce wypełniane ręcznie na papierze przez kadrę (części IV–VI)
Mapowanie pól formularza na punkty II.1–II.9: SPEC.md, sekcja „Pola formularzy”.
-->

# KARTA KWALIFIKACYJNA UCZESTNIKA WYPOCZYNKU

## I. Informacje dotyczące wypoczynku

**1. Forma wypoczynku**¹⁾

- [ ] kolonia
- [ ] zimowisko
- [ ] obóz
- [ ] biwak
- [X] półkolonia
- [ ] inna forma wypoczynku ……………………………………… (proszę podać formę)

**2. Termin wypoczynku:** {{turnus_od}} – {{turnus_do}}

**3. Adres wypoczynku, lokalizacja miejsca wypoczynku:**
{{turnus_adres}}

Trasa wypoczynku o charakterze wędrownym²⁾: nie dotyczy

Nazwa kraju w przypadku wypoczynku organizowanego za granicą: nie dotyczy

| | |
|---|---|
| Gdańsk, {{data_wystawienia_karty}} | {{podpis_organizatora}} {{pieczatka}} |
| (miejscowość, data) | (podpis organizatora wypoczynku) |

## II. Informacje dotyczące uczestnika wypoczynku

**1. Imię (imiona) i nazwisko:** {{dziecko_imie_nazwisko}}

**2. Imiona i nazwiska rodziców:**
{{rodzic_1_imie_nazwisko}}
{{rodzic_2_imie_nazwisko}}

**3. Rok urodzenia:** {{dziecko_rok_urodzenia}}

**4. Numer PESEL:** {{dziecko_pesel}}

**5. Adres zamieszkania:** {{dziecko_adres}}

**6. Adres zamieszkania lub pobytu rodziców**³⁾**:**
{{rodzice_adres}}

**7. Numer telefonu rodziców lub numer telefonu osoby wskazanej przez pełnoletniego uczestnika wypoczynku, pod którym rodzice lub ta osoba są dostępni w czasie trwania wypoczynku:**
{{rodzic_1_telefon}}
{{rodzic_2_telefon}}

**8. Informacja o specjalnych potrzebach edukacyjnych uczestnika wypoczynku, w szczególności o potrzebach wynikających z niepełnosprawności, niedostosowania społecznego lub zagrożenia niedostosowaniem społecznym:**
{{specjalne_potrzeby}}

**9. Istotne dane o stanie zdrowia uczestnika wypoczynku, rozwoju psychofizycznym i stosowanej diecie** (np. uczulenie na leki, pyłki, pokarmy lub jad owadów, choroba lokomocyjna, lista przyjmowanych na stałe leków i ich dawek, choroby przewlekłe, noszenie aparatu ortodontycznego, okularów lub soczewek, dieta niskokaloryczna, wegetarianizm, problemy z wyrażaniem emocji, problemy z funkcjonowaniem w grupie, lęk wysokości, hydrofobia)
{{zdrowie_opis}}

oraz o szczepieniach ochronnych wraz z podaniem roku (lub przedstawienie książeczki zdrowia z aktualnym wpisem szczepień):

- tężec: {{szczepienie_tezec}}
- błonica: {{szczepienie_blonica}}
- inne: {{szczepienia_inne}}

{{szczepienia_ksiazeczka}}

| | |
|---|---|
| {{data_podpisu}} | {{podpis_rodzica}} |
| (data) | (podpis rodziców / pełnoletniego uczestnika wypoczynku) |

## III. Decyzja organizatora wypoczynku o zakwalifikowaniu uczestnika wypoczynku do udziału w wypoczynku

Postanawiam¹⁾:

- {{kwalifikacja_tak}} zakwalifikować i skierować uczestnika na wypoczynek
- {{kwalifikacja_nie}} odmówić skierowania uczestnika na wypoczynek ze względu
  {{powod_odmowy}}

| | |
|---|---|
| {{data_decyzji}} | {{podpis_organizatora}} {{pieczatka}} |
| (data) | (podpis organizatora wypoczynku) |

## IV. Potwierdzenie przez kierownika wypoczynku pobytu uczestnika wypoczynku w miejscu wypoczynku

Uczestnik przebywał ...........................................................................................
(adres miejsca wypoczynku)

od dnia (dzień, miesiąc, rok) ........................ do dnia (dzień, miesiąc, rok) ........................

| | |
|---|---|
| ..................................... | ......................................................... |
| (data) | (podpis kierownika wypoczynku) |

## V. Informacja kierownika wypoczynku o stanie zdrowia uczestnika wypoczynku w czasie trwania wypoczynku oraz o chorobach przebytych w jego trakcie

..............................................................................................................................
..............................................................................................................................
..............................................................................................................................
..............................................................................................................................

| | |
|---|---|
| ..................................... | ......................................................... |
| (miejscowość, data) | (podpis kierownika wypoczynku) |

## VI. Informacja i spostrzeżenia wychowawcy wypoczynku dotyczące pobytu uczestnika wypoczynku

..............................................................................................................................
..............................................................................................................................
..............................................................................................................................
..............................................................................................................................
..............................................................................................................................

| | |
|---|---|
| ..................................... | ......................................................... |
| (miejscowość, data) | (podpis wychowawcy wypoczynku) |

---

¹⁾ Właściwe zaznaczyć znakiem „X”.
²⁾ W przypadku wypoczynku o charakterze wędrownym.
³⁾ W przypadku uczestnika niepełnoletniego.

<!--
Uwagi dla generatora PDF:
- {{kwalifikacja_tak}} / {{kwalifikacja_nie}} to pola wyboru: „[X]” albo „[ ]”; przed decyzją biura oba „[ ]”,
  a część III bez daty i podpisu.
- {{zdrowie_opis}} składa się z osobnych pól formularza (uczulenia, leki i dawki, choroby, aparat/okulary/soczewki,
  dieta, emocje, funkcjonowanie w grupie, lęk wysokości, hydrofobia, inne) w czytelny opis; puste pola pomijane.
- {{szczepienia_ksiazeczka}}: „Przedstawię książeczkę zdrowia z aktualnym wpisem szczepień.” albo puste.
- {{data_wystawienia_karty}}: dzień wygenerowania karty dla zgłoszenia.
- Części IV–VI zostają puste: wypełnia je kadra na papierze.
- {{rodzic_2_imie_nazwisko}} i {{rodzic_2_telefon}} są opcjonalne (puste wiersze pomijane); kartę podpisuje jeden rodzic
  ({{podpis_rodzica}}), a pod podpisem system dopisuje jego oświadczenie o drugim rodzicu z umowy (§ 11 ust. 3).
- {{dziecko_rok_urodzenia}} wyliczany z PESEL; formularz nie ma pola daty urodzenia.
-->
