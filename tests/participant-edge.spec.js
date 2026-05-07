const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

async function loadDiagram(page, code) {
  await page.goto(FILE_URL);
  await page.evaluate((c) => { document.getElementById('editor').value = c; }, code);
  await page.click('button.btn.btn-accent');
  await page.waitForTimeout(1200);
}

async function getOverlayLabels(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.participant-label')].map(l => l.textContent.trim())
  );
}

// ── box grouping pushes participants down in SVG ───────────────────────────
test('box grouping — all participants pinned', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    box Blue Group
      participant Alice
      participant Bob
    end
    box Red Group
      participant Charlie
    end
    Alice->>Bob: Hi
    Bob->>Charlie: Hey`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const names = await getOverlayLabels(page);
  expect(names).toContain('Alice');
  expect(names).toContain('Bob');
  expect(names).toContain('Charlie');
});

// ── autonumber ─────────────────────────────────────────────────────────────
test('autonumber sequence diagram — participants pinned', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    autonumber
    participant Alice
    participant Bob
    Alice->>Bob: Hello
    Bob-->>Alice: Hi`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const names = await getOverlayLabels(page);
  expect(names).toContain('Alice');
  expect(names).toContain('Bob');
});

// ── create participant (dynamic, mid-diagram) ──────────────────────────────
test('create participant mid-diagram — initial participants still pinned', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello
    create participant Charlie
    Bob->>Charlie: Hey`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const names = await getOverlayLabels(page);
  expect(names).toContain('Alice');
  expect(names).toContain('Bob');
});

// ── notes above/left/right ─────────────────────────────────────────────────
test('sequence diagram with notes — participants pinned', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant Alice
    participant Bob
    Note over Alice,Bob: This is a note
    Alice->>Bob: Hello
    Note right of Bob: Another note
    Bob-->>Alice: Hi`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const names = await getOverlayLabels(page);
  expect(names).toContain('Alice');
  expect(names).toContain('Bob');
});

// ── alt / loop blocks ──────────────────────────────────────────────────────
test('alt/loop blocks — participants pinned', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant Client
    participant Server
    Client->>Server: Request
    alt success
      Server-->>Client: 200 OK
    else error
      Server-->>Client: 500 Error
    end
    loop every 5s
      Client->>Server: Ping
    end`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const names = await getOverlayLabels(page);
  expect(names).toContain('Client');
  expect(names).toContain('Server');
});

// ── long participant names that may wrap in SVG ────────────────────────────
test('very long participant names', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    participant LongNameParticipantOne
    participant LongNameParticipantTwo
    LongNameParticipantOne->>LongNameParticipantTwo: Hello
    LongNameParticipantTwo-->>LongNameParticipantOne: Hi`);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const names = await getOverlayLabels(page);
  expect(names).toContain('LongNameParticipantOne');
  expect(names).toContain('LongNameParticipantTwo');
});

// ── participant declared after first message (uncommon) ────────────────────
test('participant declared after messages', async ({ page }) => {
  await loadDiagram(page, `sequenceDiagram
    Alice->>Bob: First
    participant Charlie
    Bob->>Charlie: Second`);

  const names = await getOverlayLabels(page);
  // Alice and Bob should be detected (implicit); Charlie via declaration
  expect(names.length).toBeGreaterThan(0);
});
