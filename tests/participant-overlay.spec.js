const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

async function loadDiagram(page, code) {
  await page.goto(FILE_URL);
  await page.evaluate((c) => {
    document.getElementById('editor').value = c;
  }, code);
  await page.click('button.btn.btn-accent'); // Render
  await page.waitForTimeout(1000);
}

async function getOverlayLabels(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('.participant-label')];
    return labels.map(l => ({
      text: l.textContent.trim(),
      visible: l.style.display !== 'none',
      left: l.style.left,
    }));
  });
}

// ── Case 1: explicit participant declarations ──────────────────────────────
test('explicit participants render overlay', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello
    Bob-->>Alice: Hi`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  const names = labels.map(l => l.text);
  expect(names).toContain('Alice');
  expect(names).toContain('Bob');
});

// ── Case 2: participant with alias ─────────────────────────────────────────
test('participant alias — shows alias display name', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant A as Alice Wonderland
    participant B as Bob Builder
    A->>B: Hello
    B-->>A: Hi`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  const names = labels.map(l => l.text);
  expect(names).toContain('Alice Wonderland');
  expect(names).toContain('Bob Builder');
});

// ── Case 3: implicit participants (no declarations, inferred from arrows) ──
test('implicit participants inferred from arrow lines', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi
    Alice->>Charlie: Hey
    Charlie-->>Alice: Hey back`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  const names = labels.map(l => l.text);
  expect(names).toContain('Alice');
  expect(names).toContain('Bob');
  expect(names).toContain('Charlie');
});

// ── Case 4: actor keyword ──────────────────────────────────────────────────
test('actor keyword creates overlay', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    actor User
    participant System
    User->>System: Login
    System-->>User: OK`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  const names = labels.map(l => l.text);
  expect(names).toContain('User');
  expect(names).toContain('System');
});

// ── Case 5: participant names with spaces (multi-word, no alias) ───────────
test('multi-word participant name without alias', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant Web Browser
    participant API Server
    Web Browser->>API Server: GET /data
    API Server-->>Web Browser: 200 OK`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  const names = labels.map(l => l.text);
  expect(names).toContain('Web Browser');
  expect(names).toContain('API Server');
});

// ── Case 6: emojis in participant names ────────────────────────────────────
test('participant names with emojis', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant Alice as 🐶 Biscuit
    participant Bob as 🐱 Maple
    Alice->>Bob: Hello
    Bob-->>Alice: Meow`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  const names = labels.map(l => l.text);
  expect(names).toContain('🐶 Biscuit');
  expect(names).toContain('🐱 Maple');
});

// ── Case 7: many participants (tests topCutoff) ────────────────────────────
test('many participants all appear in overlay', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant A
    participant B
    participant C
    participant D
    participant E
    participant F
    A->>B: msg
    B->>C: msg
    C->>D: msg
    D->>E: msg
    E->>F: msg`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const labels = await getOverlayLabels(page);
  expect(labels.length).toBe(6);
});

// ── Case 8: non-sequence diagram does NOT show overlay ─────────────────────
test('flowchart does not activate overlay', async ({ page }) => {
  await loadDiagram(page, `graph TD
    A[Start] --> B[End]`);

  await expect(page.locator('#seq-mode-badge')).not.toHaveClass(/active/);
  await expect(page.locator('#participant-overlay')).toBeHidden();
});
