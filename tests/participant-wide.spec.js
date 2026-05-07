const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

const WIDE_DIAGRAM = `sequenceDiagram
    participant Frontend as 🖥️ Frontend
    participant AuthService as 🔐 Auth Service
    participant APIGateway as 🌐 API Gateway
    participant UserService as 👤 User Service
    participant OrderService as 📦 Order Service
    participant PaymentService as 💳 Payment Service
    participant NotificationService as 🔔 Notification Service
    participant Database as 🗄️ Database

    Frontend->>AuthService: POST /login {username, password}
    AuthService->>Database: SELECT user WHERE username=?
    Database-->>AuthService: User record
    AuthService-->>Frontend: JWT token

    Frontend->>APIGateway: GET /orders (Authorization: Bearer token)
    APIGateway->>AuthService: Validate token
    AuthService-->>APIGateway: Token valid, userId=42

    APIGateway->>OrderService: GET /orders?userId=42
    OrderService->>Database: SELECT orders WHERE userId=42
    Database-->>OrderService: Order list
    OrderService-->>APIGateway: Orders JSON
    APIGateway-->>Frontend: Orders response

    Frontend->>APIGateway: POST /checkout {orderId, paymentInfo}
    APIGateway->>PaymentService: Process payment
    PaymentService->>Database: INSERT transaction
    Database-->>PaymentService: Transaction ID
    PaymentService-->>APIGateway: Payment success

    APIGateway->>NotificationService: Send confirmation email
    NotificationService-->>APIGateway: Email queued
    APIGateway-->>Frontend: Checkout complete`;

async function loadDiagram(page, code) {
  await page.goto(FILE_URL);
  await page.evaluate((c) => { document.getElementById('editor').value = c; }, code);
  await page.click('button.btn.btn-accent');
  await page.waitForTimeout(1500);
}

async function getOverlayInfo(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('.participant-label')];
    const wrap = document.getElementById('preview-wrap');
    const wrapRect = wrap.getBoundingClientRect();
    return {
      count: labels.length,
      wrapWidth: wrapRect.width,
      labels: labels.map(l => ({
        text: l.textContent.trim(),
        visible: l.style.display !== 'none',
        left: parseFloat(l.style.left) || 0,
        width: l.offsetWidth,
      })),
    };
  });
}

test('wide diagram — all 8 participants appear in overlay', async ({ page }) => {
  await loadDiagram(page, WIDE_DIAGRAM);

  await expect(page.locator('#seq-mode-badge')).toHaveClass(/active/);
  const info = await getOverlayInfo(page);

  console.log(`Overlay count: ${info.count}, viewport width: ${info.wrapWidth}px`);
  info.labels.forEach(l => console.log(`  "${l.text}" left=${l.left}px width=${l.width}px visible=${l.visible}`));

  expect(info.count).toBe(8);
});

test('wide diagram — labels stay within preview-wrap bounds', async ({ page }) => {
  await loadDiagram(page, WIDE_DIAGRAM);

  const info = await getOverlayInfo(page);
  const padding = 8;

  for (const label of info.labels) {
    if (!label.visible) continue;
    expect(label.left).toBeGreaterThanOrEqual(padding - 1);
    expect(label.left + label.width).toBeLessThanOrEqual(info.wrapWidth - padding + 1);
  }
});

test('wide diagram — panning right hides off-screen labels', async ({ page }) => {
  await loadDiagram(page, WIDE_DIAGRAM);

  // Pan far to the right so left participants go off screen
  await page.evaluate(() => {
    if (window.panZoomInstance) {
      panZoomInstance.pan({ x: -800, y: 0 });
    }
  });
  await page.waitForTimeout(200);

  const info = await getOverlayInfo(page);
  const hiddenCount = info.labels.filter(l => !l.visible).length;
  console.log(`After panning right: ${hiddenCount} labels hidden`);

  // At least some labels should be hidden or clamped when panned far right
  const clampedOrHidden = await page.evaluate(() =>
    [...document.querySelectorAll('.participant-label')].filter(l =>
      l.style.display === 'none' || l.classList.contains('clamped')
    ).length
  );
  expect(clampedOrHidden).toBeGreaterThan(0);
});

test('wide diagram — zoom out shows more participants visible', async ({ page }) => {
  await loadDiagram(page, WIDE_DIAGRAM);

  // Zoom out so more fits on screen
  await page.evaluate(() => {
    if (window.panZoomInstance) {
      panZoomInstance.zoom(0.4);
      panZoomInstance.center();
    }
  });
  await page.waitForTimeout(300);

  const info = await getOverlayInfo(page);
  const visibleCount = info.labels.filter(l => l.visible).length;
  console.log(`After zoom out: ${visibleCount}/${info.count} labels visible`);
  expect(visibleCount).toBeGreaterThan(0);
});
