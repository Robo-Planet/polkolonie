// Test end-to-end (ręczny): wymaga działającego serwera (npm run start) i konta administratora.
// Użycie:
//   APP_URL=http://localhost:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//   SERVER_LOG=/ścieżka/do/server.log node tests/e2e/smoke.mjs
// Przeglądarka: Chromium z przygotowanego środowiska (bez instalacji Playwright).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const OTPAuth = require("otpauth");

const APP = process.env.APP_URL ?? "http://localhost:3001";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_TOTP_SECRET;
const LOG = process.env.SERVER_LOG;

const totp = () => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(SECRET), algorithm: "SHA1", digits: 6, period: 30 }).generate();
const check = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
};

async function login(page, code = totp()) {
  await page.goto(`${APP}/admin/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.fill('input[name="code"]', code);
  await page.click('button[type="submit"]');
}

const browser = await chromium.launch();
try {
  // 1. Złe hasło / zły kod nie logują.
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
  await admin.fill('input[name="number"]', "I");
  await admin.fill('input[name="startDate"]', "2027-02-01");
  await admin.fill('input[name="endDate"]', "2027-02-05");
  await admin.fill('input[name="venue"]', "ul. Marusarzówny 2/39, 80-288 Gdańsk");
  await admin.fill('input[name="placeLimit"]', "20");
  await admin.fill('input[name="price"]', "920");
  await admin.click('button[type="submit"]');
  await admin.waitForURL(`${APP}/admin`);
  check((await admin.textContent("table")).includes("0 / 20"), "turnus I widoczny w panelu z 0/20 miejsc");

  // 3. Krótkie zgłoszenie na stronie publicznej.
  const parent = await browser.newContext();
  const page = await parent.newPage();
  await page.goto(`${APP}/zapis`);
  const option = await page.$eval('select[name="turnusId"] option:nth-of-type(2)', (o) => o.textContent);
  check(option.includes("zostało 20 z 20 miejsc"), `licznik miejsc na stronie zapisu: "${option.trim()}"`);
  await page.selectOption('select[name="turnusId"]', { index: 1 });
  await page.fill('input[name="parentFirstName"]', "Anna");
  await page.fill('input[name="parentLastName"]', "Testowa");
  await page.fill('input[name="parentEmail"]', "rodzic.test@example.com");
  await page.fill('input[name="parentPhone"]', "600 123 456");
  await page.fill('input[name="childFirstName"]', "Jan");
  await page.check('input[name="rodoConsent"]');
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Wysłaliśmy link");
  const confirmation = await page.textContent('[role="status"]');
  const code = confirmation.match(/RP-[A-Z0-9]+-\d{4}/)?.[0];
  check(!!code, `zgłoszenie utworzone, kod ${code}`);

  // 4. Link z e-maila (w trybie log e-mail trafia do logu serwera).
  await new Promise((r) => setTimeout(r, 500));
  const log = LOG ? readFileSync(LOG, "utf8") : "";
  const link = [...log.matchAll(/http:\/\/localhost:3001\/zgloszenie\/[A-Za-z0-9_-]+/g)].at(-1)?.[0];
  check(!!link, "link z e-maila znaleziony w logu poczty");
  await page.goto(link);
  await page.click('button:has-text("Potwierdzam adres e-mail")');
  await page.waitForSelector("text=Adres e-mail potwierdzony");
  check(true, "kliknięcie linku potwierdza adres e-mail");

  // 5. Zgłoszenie widoczne w panelu i w dzienniku.
  await admin.goto(`${APP}/admin`);
  await admin.click(`text=I`);
  await admin.waitForSelector(`text=${code}`);
  check(true, `zgłoszenie ${code} widoczne w panelu`);
  await admin.click(`a:has-text("${code}")`);
  await admin.waitForSelector("text=email.confirmed");
  check(true, "dziennik zdarzeń zawiera potwierdzenie e-maila");
  await admin.waitForSelector("text=application.created");
  check(true, "dziennik zdarzeń zawiera utworzenie zgłoszenia");

  // 6. Pułapka na boty: wypełnione ukryte pole nie tworzy zgłoszenia.
  const botPage = await browser.newPage();
  await botPage.goto(`${APP}/zapis`);
  await botPage.selectOption('select[name="turnusId"]', { index: 1 });
  await botPage.$eval('input[name="website"]', (el) => (el.value = "spam"));
  await botPage.fill('input[name="parentFirstName"]', "Bot");
  await botPage.fill('input[name="parentLastName"]', "Bot");
  await botPage.fill('input[name="parentEmail"]', "bot@example.com");
  await botPage.fill('input[name="parentPhone"]', "600123456");
  await botPage.fill('input[name="childFirstName"]', "Bot");
  await botPage.check('input[name="rodoConsent"]');
  await botPage.click('button[type="submit"]');
  await botPage.waitForSelector('[role="status"]');
  await admin.goto(`${APP}/admin`);
  await admin.click("text=I");
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
