// Smoke test: verifies the landing → QuickForm household prefill
// and Account settings household editing (with legacy migration).
// Run with:  node scripts/smoke-household-prefill.mjs
//
// Assumes the dev server is running on http://localhost:5173

import { chromium } from 'playwright'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5173'

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))

  try {
    // ── Test 1: QuickForm prefill from landing selection ──
    console.log('\n[1] QuickForm prefill from landing sessionStorage')

    // Seed sessionStorage as if the user picked woman + man + dog on landing.
    // We use addInitScript so it's set on every page in this context before any script runs.
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem('estato:household', JSON.stringify(['woman', 'man', 'dog']))
      } catch {}
    })

    await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' })

    // Fill the City input so the form becomes submittable (and so we can see the rest)
    const cityInput = page.locator('input[placeholder="e.g. Madrid"]')
    await cityInput.waitFor({ state: 'visible', timeout: 10000 })

    // Assert "People moving in" shows "2 people" (woman + man → 2)
    const peopleLabel = page.getByText(/2 people|Just me|\d people/).first()
    const peopleText = await peopleLabel.textContent()
    assert(peopleText?.trim() === '2 people', `people count prefilled to "2 people" (got "${peopleText?.trim()}")`)

    // Assert "Dog" pet pill is selected (has accent background)
    const dogPill = page.getByRole('button', { name: 'Dog' })
    const catPill = page.getByRole('button', { name: 'Cat' })
    const dogBg = await dogPill.evaluate((el) => getComputedStyle(el).backgroundColor)
    const catBg = await catPill.evaluate((el) => getComputedStyle(el).backgroundColor)
    assert(dogBg !== catBg, `Dog pill is styled differently from Cat (selected state): dog=${dogBg} cat=${catBg}`)

    // ── Test 2: Prefill for solo + cat ──
    console.log('\n[2] QuickForm prefill: no person chars + cat → "Just me" + Cat pet')

    const ctx2 = await browser.newContext()
    await ctx2.addInitScript(() => {
      sessionStorage.setItem('estato:household', JSON.stringify(['cat']))
    })
    const page2 = await ctx2.newPage()
    page2.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
    await page2.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' })
    await page2.locator('input[placeholder="e.g. Madrid"]').waitFor()
    const soloText = await page2.getByText(/Just me|\d people/).first().textContent()
    assert(soloText?.trim() === 'Just me', `solo defaults to "Just me" (got "${soloText?.trim()}")`)
    const catPill2 = page2.getByRole('button', { name: 'Cat' })
    const dogPill2 = page2.getByRole('button', { name: 'Dog' })
    const catBg2 = await catPill2.evaluate((el) => getComputedStyle(el).backgroundColor)
    const dogBg2 = await dogPill2.evaluate((el) => getComputedStyle(el).backgroundColor)
    assert(catBg2 !== dogBg2, `Cat is selected, Dog is not: cat=${catBg2} dog=${dogBg2}`)
    await ctx2.close()

    // ── Test 3: Account page loads legacy "occupants: Couple" → adults:2 ──
    console.log('\n[3] Account settings migrates legacy occupants string')

    const ctx3 = await browser.newContext()
    await ctx3.addInitScript(() => {
      localStorage.setItem('estato_user_profile', JSON.stringify({
        city: 'Madrid',
        occupants: 'Couple',
      }))
    })
    const page3 = await ctx3.newPage()
    page3.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
    await page3.goto(`${BASE}/account`, { waitUntil: 'networkidle' })
    await page3.getByText('Search Preferences', { exact: true }).waitFor({ timeout: 10000 })
    const accPeople = await page3.getByText(/Just me|\d people/).first().textContent()
    assert(accPeople?.trim() === '2 people', `legacy "Couple" migrated to "2 people" (got "${accPeople?.trim()}")`)
    await ctx3.close()

    // ── Test 4: Account page loads adults + pets fields from new profile ──
    console.log('\n[4] Account settings loads adults + pets from new profile shape')

    const ctx4 = await browser.newContext()
    await ctx4.addInitScript(() => {
      localStorage.setItem('estato_user_profile', JSON.stringify({
        city: 'Madrid',
        adults: 3,
        pets: ['dog'],
      }))
    })
    const page4 = await ctx4.newPage()
    page4.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
    await page4.goto(`${BASE}/account`, { waitUntil: 'networkidle' })
    await page4.getByText('Search Preferences', { exact: true }).waitFor({ timeout: 10000 })
    const acc4People = await page4.getByText(/Just me|\d people/).first().textContent()
    assert(acc4People?.trim() === '3 people', `adults:3 renders as "3 people" (got "${acc4People?.trim()}")`)
    const acc4Dog = page4.getByRole('button', { name: 'Dog' })
    const acc4Cat = page4.getByRole('button', { name: 'Cat' })
    const acc4DogBg = await acc4Dog.evaluate((el) => getComputedStyle(el).backgroundColor)
    const acc4CatBg = await acc4Cat.evaluate((el) => getComputedStyle(el).backgroundColor)
    assert(acc4DogBg !== acc4CatBg, `Account: Dog selected, Cat not: dog=${acc4DogBg} cat=${acc4CatBg}`)
    await ctx4.close()

    // ── Test 5: Account stepper increments ──
    console.log('\n[5] Account stepper increments people count')

    const ctx5 = await browser.newContext()
    await ctx5.addInitScript(() => {
      localStorage.setItem('estato_user_profile', JSON.stringify({ city: 'Madrid', adults: 1 }))
    })
    const page5 = await ctx5.newPage()
    page5.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
    await page5.goto(`${BASE}/account`, { waitUntil: 'networkidle' })
    await page5.getByText('Search Preferences', { exact: true }).waitFor()

    // Find the "People moving in" label, then the + button that follows it
    const peopleSection = page5.locator('p:has-text("People moving in")').first()
    await peopleSection.waitFor()
    // Plus button is the second button inside the same container row
    const plusBtn = peopleSection.locator('..').locator('button').nth(1)
    await plusBtn.click()
    await plusBtn.click()
    const after = await page5.getByText(/Just me|\d people/).first().textContent()
    assert(after?.trim() === '3 people', `increment 1→3 (got "${after?.trim()}")`)
    await ctx5.close()

    console.log('\n✅ All smoke tests passed\n')
  } catch (err) {
    console.error('\n❌ Test failed:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
