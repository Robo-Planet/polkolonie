// Test end-to-end (ręczny): wymaga działającego serwera (npm run start) i konta administratora.
// Każdy przebieg tworzy turnus o unikalnym numerze, więc można go uruchamiać wielokrotnie
// bez czyszczenia bazy.
// Użycie:
//   APP_URL=http://localhost:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//   SERVER_LOG=/ścieżka/do/server.log node tests/e2e/smoke.mjs
// Przeglądarka: Chromium z przygotowanego środowiska (bez instalacji Playwright).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OTPAuth = require("otpauth");

const APP = (process.env.APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_TOTP_SECRET;
const LOG = process.env.SERVER_LOG;

const RUN = String(Date.now()).slice(-6);
const TURNUS = `T${RUN}`; // unikalny numer turnusu dla tego przebiegu

const totp = () => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(SECRET), algorithm: "SHA1", digits: 6, period: 30 }).generate();
const check = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
};

// Przycisk zatwierdzający formularz strony (nie przycisk „Wyloguj” w nagłówku panelu).
const SUBMIT = 'main form button[type="submit"]';

async function login(page, code = totp()) {
  await page.goto(`${APP}/admin/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.fill('input[name="code"]', code);
  await page.click(SUBMIT);
}

// Wartość opcji naszego turnusu w formularzu zapisu (wyszukiwana po numerze, nie po indeksie).
async function turnusValue(page) {
  return page.locator('select[name="turnusId"] option', { hasText: `Turnus ${TURNUS}:` }).getAttribute("value");
}

const browser = await chromium.launch();
try {
  // 1. Złe kody nie logują.
  const bad = await browser.newContext();
  const badPage = await bad.newPage();
  await login(badPage, "000000");
  await badPage.waitForSelector('[role="alert"]:has-text("Nieprawidłowe")');
  check(true, "zły kod TOTP jest odrzucany");
  await bad.close();

  // 2. Logowanie i dodanie turnusu.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin);
  await admin.waitForURL(`${APP}/admin`);
  check(true, "logowanie administratora (hasło + TOTP) przechodzi do panelu");

  await admin.goto(`${APP}/admin/turnusy/nowy`);
  await admin.fill('input[name="number"]', TURNUS);
  await admin.fill('input[name="startDate"]', "2027-02-01");
  await admin.fill('input[name="endDate"]', "2027-02-05");
  await admin.fill('input[name="venue"]', "ul. Marusarzówny 2/39, 80-288 Gdańsk");
  await admin.fill('input[name="placeLimit"]', "20");
  await admin.fill('input[name="price"]', "920");
  await admin.click(SUBMIT);
  await admin.waitForURL(`${APP}/admin`);
  const row = admin.locator("tr", { hasText: TURNUS });
  check((await row.textContent()).includes("0 / 20"), `turnus ${TURNUS} widoczny w panelu z 0/20 miejsc`);

  // 3. Krótkie zgłoszenie na stronie publicznej.
  // Każdy przebieg to inny adres klienta (dławienie zgłoszeń liczy po IP z X-Forwarded-For).
  const clientIp = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
  const parent = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientIp } });
  const page = await parent.newPage();
  await page.goto(`${APP}/zapis`);
  const optionText = await page.locator('select[name="turnusId"] option', { hasText: `Turnus ${TURNUS}:` }).textContent();
  check(optionText.includes("zostało 20 z 20 miejsc"), `licznik miejsc na stronie zapisu: "${optionText.trim()}"`);
  await page.selectOption('select[name="turnusId"]', await turnusValue(page));
  await page.fill('input[name="parentFirstName"]', "Anna");
  await page.fill('input[name="parentLastName"]', "Testowa");
  await page.fill('input[name="parentEmail"]', "rodzic.test@example.com");
  await page.fill('input[name="parentPhone"]', "600 123 456");
  await page.fill('input[name="childFirstName"]', "Jan");
  await page.check('input[name="rodoConsent"]');
  await page.click(SUBMIT);
  await page.waitForSelector("text=Wysłaliśmy link");
  const confirmation = await page.textContent('[role="status"]');
  const code = confirmation.match(/RP-[A-Z0-9]+-\d{4}/)?.[0];
  check(!!code, `zgłoszenie utworzone, kod ${code}`);

  // 4. Link z e-maila (tryb log: e-mail trafia do logu serwera).
  await new Promise((r) => setTimeout(r, 500));
  const log = LOG ? readFileSync(LOG, "utf8") : "";
  const escapedApp = APP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const link = [...log.matchAll(new RegExp(escapedApp + "/zgloszenie/[A-Za-z0-9_-]+", "g"))].at(-1)?.[0];
  check(!!link, "link z e-maila znaleziony w logu poczty");
  await page.goto(link);
  await page.click('button:has-text("Potwierdzam adres e-mail")');
  await page.waitForSelector("text=Adres e-mail potwierdzony");
  check(true, "kliknięcie linku potwierdza adres e-mail");

  // 4b. Pełny formularz: szkic, potem wysłanie (dziecko 6-letnie, PESEL 20231512341 – 2020-03-15).
  await page.goto(`${link}/formularz`);
  await page.fill('input[name="childLastName"]', "Testowy");
  await page.fill('input[name="pesel"]', "20231512341");
  await page.fill('input[name="parentAddress"]', "ul. Testowa 1");
  await page.fill('input[name="parentPostalCode"]', "80-288");
  await page.fill('input[name="parentCity"]', "Gdańsk");
  await page.check('input[name="childSameAddress"]');
  await page.selectOption('select[name="selfReturn"]', "nie");
  await page.fill('input[name="pickupTime"]', "16:30");
  await page.check('input[name="regulaminAccepted"]');
  await page.check('input[name="healthConsent"]');
  await page.click('button[value="draft"]');
  await page.waitForSelector("text=Szkic zapisany");
  check(true, "szkic formularza zapisany");
  await page.click('button[value="submit"]');
  await page.waitForSelector("text=Formularz wysłany");
  check(true, "pełny formularz wysłany (walidacja wieku i zgód przeszła)");
  const pdf = await page.request.get(`${link}/karta`);
  check(pdf.status() === 200 && (pdf.headers()["content-type"] ?? "").includes("application/pdf"), "podgląd karty (PDF) dostępny dla rodzica");

  // 5. Zgłoszenie widoczne w panelu i w dzienniku.
  await admin.goto(`${APP}/admin`);
  await admin.click(`a:has-text("${TURNUS}")`);
  await admin.waitForSelector(`text=${code}`);
  check(true, `zgłoszenie ${code} widoczne w panelu`);
  await admin.click(`a:has-text("${code}")`);
  await admin.waitForSelector("text=email.confirmed");
  check(true, "dziennik zdarzeń zawiera potwierdzenie e-maila");
  await admin.waitForSelector("text=application.created");
  check(true, "dziennik zdarzeń zawiera utworzenie zgłoszenia");
  await admin.waitForSelector("text=form.submitted");
  check(true, "dziennik zdarzeń zawiera wysłanie formularza");

  // 5b. Płatność: zaliczka 200 zł przypisana alertem (syntetyczny e-mail z fixtury, z kodem w tytule).
  // Podpis DKIM po zmianie treści nie przechodzi, więc alert trafia do przetwarzania z --no-dkim.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixture = readFileSync(path.join(here, "..", "fixtures", "alerty24-wplyw-zmodyfikowany.eml"), "utf8");
  const alertId = String(Math.floor(Math.random() * 1e9));
  const synthetic = fixture
    .replace(/(Ile:[\s\S]*?<b>\s*)1,00 PLN/, "$1200,00 PLN")
    .replace(/(Tytuł:[\s\S]*?<b>\s*)przelew/, `$1${code} Jan Testowy`)
    .replace("Identyfikator wiadomości: -1540367547", `Identyfikator wiadomości: -${alertId}`)
    .replace("<b7047f5-778-2fd8-281b-6676717bd6>", `<e2e-${alertId}@erste.pl>`);
  const tmpDir = path.join(here, ".tmp");
  mkdirSync(tmpDir, { recursive: true });
  const alertFile = path.join(tmpDir, `alert-${alertId}.eml`);
  writeFileSync(alertFile, synthetic, "utf8");
  const repo = path.join(here, "..", "..");
  const strict = execFileSync("npx", ["tsx", "scripts/ingest-alert.ts", alertFile], { cwd: repo, encoding: "utf8" });
  check(strict.includes('"status":"rejected"') && strict.includes("treść wiadomości została zmieniona"), "alert ze zmienioną treścią odrzucony przy weryfikacji DKIM");
  const ingest = execFileSync("npx", ["tsx", "scripts/ingest-alert.ts", alertFile, "--no-dkim"], { cwd: repo, encoding: "utf8" });
  check(ingest.includes('"status":"created"') && ingest.includes('"matchStatus":"MATCHED"'), "alert z kodem zgłoszenia przypisany automatycznie (MATCHED)");
  rmSync(tmpDir, { recursive: true, force: true });

  await admin.goto(`${APP}/admin`);
  await admin.click(`a:has-text("${TURNUS}")`);
  await admin.click(`a:has-text("${code}")`);
  await admin.waitForSelector("text=Ma miejsce (po zaliczce)");
  check(true, "po wpłacie zaliczki zgłoszenie ma miejsce (status: Ma miejsce)");
  await admin.waitForSelector("text=payment.allocated");
  check(true, "dziennik zawiera przypisanie wpłaty");

  // 6. Pułapka na boty: wypełnione ukryte pole nie tworzy zgłoszenia.
  const botCtx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientIp } });
  const botPage = await botCtx.newPage();
  await botPage.goto(`${APP}/zapis`);
  await botPage.selectOption('select[name="turnusId"]', await turnusValue(botPage));
  await botPage.$eval('input[name="website"]', (el) => (el.value = "spam"));
  await botPage.fill('input[name="parentFirstName"]', "Bot");
  await botPage.fill('input[name="parentLastName"]', "Bot");
  await botPage.fill('input[name="parentEmail"]', "bot@example.com");
  await botPage.fill('input[name="parentPhone"]', "600123456");
  await botPage.fill('input[name="childFirstName"]', "Bot");
  await botPage.check('input[name="rodoConsent"]');
  await botPage.click(SUBMIT);
  await botPage.waitForSelector('[role="status"]');
  await admin.goto(`${APP}/admin`);
  await admin.click(`a:has-text("${TURNUS}")`);
  check(!(await admin.textContent("body")).includes("bot@example.com"), "zgłoszenie bota nie trafia do bazy");

  // 7. Wylogowanie zamyka dostęp do panelu.
  await admin.goto(`${APP}/admin`);
  await admin.click('button:has-text("Wyloguj")');
  await admin.waitForURL(`${APP}/admin/login`);
  await admin.goto(`${APP}/admin/organizator`);
  check(admin.url().includes("/admin/login"), "po wylogowaniu panel jest zamknięty");

  console.log("\nWSZYSTKIE KROKI E2E ZALICZONE");
} finally {
  await browser.close();
}
