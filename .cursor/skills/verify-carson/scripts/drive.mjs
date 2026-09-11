#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(list) {
  const out = {}
  for (let i = 0; i < list.length; i += 1) {
    const token = list[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = list[i + 1]
    if (!next || next.startsWith('--')) out[key] = '1'
    else {
      out[key] = next
      i += 1
    }
  }
  return out
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function dismissOnboarding(page) {
  const dialog = page.getByRole('dialog', { name: 'Wreck this poster' })
  const skip = page.getByRole('button', { name: 'Skip intro' })
  try {
    await dialog.waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    return
  }
  await skip.click()
  await dialog.waitFor({ state: 'hidden' })
}

async function enterEditorFromHome(page) {
  const home = page.getByRole('region', { name: 'Home' })
  await home.waitFor({ state: 'visible' })
  const wreck = page.getByRole('button', { name: 'Start from wreck' })
  if (await wreck.count()) await wreck.click()
  else {
    const card = page.getByRole('button', { name: /^Open / }).first()
    await card.click()
  }
  await page.getByRole('region', { name: 'Poster canvas' }).waitFor({ state: 'visible' })
}

async function capture(page, outDir, stem) {
  const aria = await page.locator('body').innerText()
  await writeFile(join(outDir, `${stem}.aria.txt`), aria)
  await page.screenshot({ path: join(outDir, `${stem}.png`), fullPage: true })
}

async function openTab(page, name) {
  await page.getByRole('tab', { name }).click()
}

function layerSelect(page, name) {
  return page.getByTitle('Select layer · double-click to zoom to layer').filter({ hasText: name })
}

function inspectorName(page) {
  return page.getByRole('complementary', { name: 'Inspector' }).getByRole('textbox', { name: 'Name' }).first()
}

const FEATURES = {
  async 'home-recents'(page, outDir) {
    const home = page.getByRole('region', { name: 'Home' })
    await home.waitFor({ state: 'visible' })
    if (await page.getByRole('region', { name: 'Poster canvas' }).count()) {
      fail('Launch showed the editor instead of Home')
    }
    await page.getByText('No saved posters yet.').waitFor()
    await page.getByRole('button', { name: 'New poster', exact: true }).waitFor()
    await capture(page, outDir, 'empty-home')
    await page.getByRole('button', { name: 'New poster', exact: true }).click()
    await page.getByRole('dialog', { name: 'New poster' }).waitFor()
    await page.getByRole('button', { name: 'Create poster' }).click()
    await page.getByRole('region', { name: 'Poster canvas' }).waitFor({ state: 'visible' })
    await page.getByRole('textbox', { name: 'Project name' }).fill('Home recents proof')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()
    await page.getByRole('button', { name: 'Home', exact: true }).click()
    await home.waitFor({ state: 'visible' })
    const card = page.getByRole('button', { name: 'Open Home recents proof' })
    await card.waitFor()
    if (!(await card.locator('img').count())) fail('Saved card was missing a thumbnail image')
    await capture(page, outDir, 'saved-grid')
    await card.click()
    await page.getByRole('region', { name: 'Poster canvas' }).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Carson home' }).click()
    await home.waitFor({ state: 'visible' })
    await card.waitFor()
    await capture(page, outDir, 'reopened')
  },

  async 'editor-baseline'(page, outDir) {
    await page.getByRole('heading', { name: 'Carson', level: 1 }).waitFor()
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').waitFor()
    await layerSelect(page, 'Red interruption').click()
    await layerSelect(page, 'Oversized headline').click()
    await openTab(page, 'Inspect')
    await inspectorName(page).waitFor()
    const name = await inspectorName(page).inputValue()
    if (name !== 'Oversized headline') fail(`Inspect name was "${name}"`)
    const text = await page.getByRole('textbox', { name: 'Text' }).inputValue()
    if (!text.includes('RAY GUN')) fail('Headline text was missing RAY GUN')
    await writeFile(join(outDir, 'inspect-headline.proof.json'), JSON.stringify({ name, text }, null, 2))
    await capture(page, outDir, 'inspect-headline')
  },

  async 'layer-groups'(page, outDir) {
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await layerSelect(page, 'Red interruption').click({ modifiers: ['Shift'] })
    const group = page.getByRole('button', { name: 'Group' }).first()
    if (await group.isDisabled()) fail('Group stayed disabled after a two-layer selection')
    await group.click()
    await page.getByRole('button', { name: /Group group/ }).waitFor()
    await capture(page, outDir, 'grouped')
    await page.getByRole('button', { name: 'Ungroup' }).first().click()
    await layerSelect(page, 'Oversized headline').waitFor()
    const grouped = await page.getByRole('button', { name: /Group group/ }).count()
    if (grouped !== 0) fail('Group row remained after Ungroup')
    await capture(page, outDir, 'ungrouped')
  },

  async 'component-instances'(page, outDir) {
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await layerSelect(page, 'Red interruption').click({ modifiers: ['Shift'] })
    await page.getByRole('button', { name: 'Group' }).first().click()
    await page.getByRole('button', { name: /Group group/ }).waitFor()
    await openTab(page, 'Assets')
    await page.getByRole('button', { name: 'Save selection as component' }).click()
    await page.getByRole('button', { name: /^Mark$/ }).waitFor()
    await page.getByRole('button', { name: /^Mark$/ }).click()
    await page.getByRole('status').filter({ hasText: /Instance of/ }).waitFor()
    await openTab(page, 'Inspect')
    await page.getByRole('button', { name: 'Detach' }).waitFor()
    await capture(page, outDir, 'instance')
    await page.getByRole('button', { name: 'Detach' }).click()
    await page.getByRole('status').filter({ hasText: /Detached/ }).waitFor()
    if (await page.getByRole('button', { name: 'Detach' }).count()) fail('Detach control remained after unlink')
    await capture(page, outDir, 'detached')
  },

  async 'xerox-treatment'(page, outDir) {
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    await page.getByRole('complementary', { name: 'Instruments' }).waitFor()
    await page.getByRole('button', { name: /Copy selected/ }).click()
    await openTab(page, 'Treatments')
    const empty = page.getByText('No layer treatments yet')
    if (await empty.isVisible().catch(() => false)) fail('Treatments tab stayed empty after Copy selected')
    await capture(page, outDir, 'treatments')
  },

  async 'copy-machine'(page, outDir) {
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    await page.getByRole('complementary', { name: 'Instruments' }).waitFor()
    await page.getByRole('button', { name: /Copy machine/ }).click()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    const empty = page.getByText('No layer treatments yet')
    if (await empty.isVisible().catch(() => false)) fail('Treatments tab stayed empty after Copy machine')
    const body = await page.locator('body').innerText()
    if (!/Copy·/.test(body)) fail('Copy machine did not land a Copy chip')
    await capture(page, outDir, 'treatments')
  },

  async 'decay-marks'(page, outDir) {
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    await page.getByRole('complementary', { name: 'Instruments' }).waitFor()
    await page.getByRole('button', { name: /Age selected/ }).click()
    await page.getByRole('button', { name: /Ink loss/ }).click()
    await page.getByRole('button', { name: /Fold marks/ }).click()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    const empty = page.getByText('No layer treatments yet')
    if (await empty.isVisible().catch(() => false)) fail('Treatments tab stayed empty after Age / Ink loss / Fold')
    const body = await page.locator('body').innerText()
    if (!/Decay·/.test(body)) fail('Age selected did not land a Decay chip')
    if (!/Ink loss·/.test(body)) fail('Ink loss did not land a stack chip')
    if (!/Fold·/.test(body)) fail('Fold marks did not land a stack chip')
    const inspector = page.getByRole('complementary', { name: 'Inspector' })
    await inspector.getByRole('button', { name: 'Re-roll seed' }).first().click()
    await inspector.getByRole('button', { name: 'Bypass' }).first().click()
    await capture(page, outDir, 'treatments')
  },

  async 'misprint-type-strips'(page, outDir) {
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    await page.getByRole('complementary', { name: 'Instruments' }).waitFor()
    await page.getByRole('button', { name: /Misprint offset/ }).click()
    await page.getByRole('button', { name: /Type strip/ }).click()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    const empty = page.getByText('No layer treatments yet')
    if (await empty.isVisible().catch(() => false)) fail('Treatments tab stayed empty after Misprint / Type strip')
    const body = await page.locator('body').innerText()
    if (!/Misprint·/.test(body)) fail('Misprint offset did not land a stack chip')
    if (!/Type strip·/.test(body)) fail('Type strip did not land a stack chip')
    const inspector = page.getByRole('complementary', { name: 'Inspector' })
    await inspector.getByRole('button', { name: 'Re-roll seed' }).first().click()
    await inspector.getByRole('button', { name: 'Bypass' }).first().click()
    await capture(page, outDir, 'treatments')
  },

  async 'export-png'(page, outDir) {
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
    await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
    const download = await downloadPromise
    const suggested = download.suggestedFilename()
    if (!/\.png$/i.test(suggested)) fail(`Export suggested "${suggested}", expected a PNG`)
    await download.saveAs(join(outDir, suggested))
    await capture(page, outDir, 'after-export')
    await writeFile(join(outDir, 'download.txt'), `${suggested}\n`)
  },

  async 'wreck-this-poster'(page, outDir) {
    const dialog = page.getByRole('dialog', { name: 'Wreck this poster' })
    await dialog.waitFor({ state: 'visible', timeout: 15000 })
    await page.getByRole('button', { name: "Let's wreck it" }).click()
    await dialog.waitFor({ state: 'hidden' })
    const coach = page.getByRole('region', { name: 'Wreck this poster' })
    await coach.waitFor({ state: 'visible' })
    await page.getByRole('complementary', { name: 'Instruments' }).waitFor()
    if (!(await coach.getByRole('heading', { name: 'Scatter the headline' }).isVisible())) {
      fail('Coach did not start on scatter')
    }
    await capture(page, outDir, 'start')
    await page.getByRole('button', { name: 'Scatter', exact: true }).click()
    await coach.getByRole('heading', { name: 'Xerox it' }).waitFor()
    await page.getByRole('button', { name: 'Re-roll last accident' }).waitFor()
    await capture(page, outDir, 'after-scatter')
    await page.getByRole('button', { name: /Copy selected/ }).click()
    await coach.getByRole('heading', { name: 'Re-roll the accident' }).waitFor()
    await capture(page, outDir, 'after-xerox')
    await page.getByRole('button', { name: 'Re-roll last accident' }).click()
    await coach.getByRole('heading', { name: 'Walk it back' }).waitFor()
    await capture(page, outDir, 'after-reroll')
    await page.getByRole('button', { name: 'Undo' }).click()
    await coach.waitFor({ state: 'hidden' })
    const status = page.getByRole('status').filter({ hasText: /whole game/i })
    await status.waitFor()
    await capture(page, outDir, 'after-undo')
  },

  async 'variations-trail'(page, outDir) {
    const trail = page.getByRole('region', { name: 'Exploration trail' })
    await trail.waitFor()
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    await page.getByRole('complementary', { name: 'Instruments' }).waitFor()
    await page.getByRole('button', { name: 'Scatter', exact: true }).click()
    const scattered = trail.getByRole('button', { name: /Scattered selection/ })
    await scattered.waitFor()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await capture(page, outDir, 'after-scatter')
    await trail.getByRole('button', { name: 'Fork', exact: true }).click()
    await page.getByRole('status').filter({ hasText: /Forked Variant/ }).waitFor()
    await trail.getByRole('button', { name: /Started a new poster/ }).click()
    await page.getByRole('status').filter({ hasText: /Started a new poster/ }).waitFor()
    await trail.getByRole('button', { name: /Started a new poster \(current\)/ }).waitFor()
    await capture(page, outDir, 'after-jump')
    await trail.getByRole('button', { name: /Comps gallery/ }).click()
    const gallery = page.getByRole('dialog', { name: 'Comps' })
    await gallery.waitFor()
    await gallery.getByRole('button', { name: 'Compare' }).click()
    const compare = page.getByRole('dialog', { name: 'Compare variations' })
    await compare.waitFor()
    await capture(page, outDir, 'after-compare')
  },

  async 'gesture-performance'(page, outDir) {
    const trail = page.getByRole('region', { name: 'Exploration trail' })
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    const instruments = page.getByRole('complementary', { name: 'Instruments' })
    await instruments.waitFor()
    await instruments.getByRole('button', { name: 'Record gesture' }).click()
    const recorded = page.getByRole('status', { name: 'Recorded plays' })
    await recorded.waitFor()
    if (!(await recorded.getByText('Play an instrument').isVisible())) {
      fail('Record did not arm an empty performance')
    }
    await instruments.getByRole('button', { name: 'Strips' }).click()
    await recorded.getByText(/Strips/).waitFor()
    await instruments.getByRole('button', { name: 'Scatter', exact: true }).click()
    await recorded.getByText(/Strips → Scatter/).waitFor()
    await instruments.getByRole('button', { name: /Copy selected/ }).click()
    await recorded.getByText(/Xerox/).waitFor()
    const chain = await recorded.innerText()
    if (!chain.includes('Strips → Scatter')) fail(`Recorded chain was "${chain}", expected Strips then Scatter`)
    if (!chain.includes('Xerox')) fail(`Recorded chain was "${chain}", expected Xerox`)
    await capture(page, outDir, 'recording')
    await instruments.getByRole('button', { name: 'Save performance' }).click()
    await instruments.getByRole('button', { name: 'Mark', exact: true }).waitFor()
    await openTab(page, 'Layers')
    await layerSelect(page, 'Red interruption').click()
    await instruments.getByRole('button', { name: 'Mark', exact: true }).click()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    const empty = page.getByText('No layer treatments yet')
    if (await empty.isVisible().catch(() => false)) fail('Treatments tab stayed empty after playing Mark')
    let body = await page.locator('body').innerText()
    if (!/Slice·/.test(body)) fail('Replay did not land a Slice chip')
    if (!/Scatter·/.test(body)) fail('Replay did not land a Scatter chip')
    if (!/Xerox·/.test(body)) fail('Replay did not land a Xerox chip')
    await trail.getByRole('button', { name: /Played Mark/ }).waitFor()
    await capture(page, outDir, 'after-instruments-replay')
    await page.getByRole('button', { name: 'Undo' }).click()
    await openTab(page, 'Layers')
    await layerSelect(page, 'Red interruption').click()
    await openTab(page, 'Treatments')
    await page.getByText('No layer treatments yet').waitFor()
    await page.getByRole('button', { name: 'Commands' }).click()
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.waitFor()
    await palette.getByPlaceholder(/Search actions/).fill('Mark')
    await palette.getByRole('button', { name: /Play Mark/ }).click()
    if (await empty.isVisible().catch(() => false)) fail('Treatments tab stayed empty after Commands replay')
    body = await page.locator('body').innerText()
    if (!/Slice·/.test(body) || !/Scatter·/.test(body) || !/Xerox·/.test(body)) {
      fail('Commands replay did not restore Slice → Scatter → Xerox')
    }
    await capture(page, outDir, 'replay')
  },

  async 'press-check'(page, outDir) {
    const trail = page.getByRole('region', { name: 'Exploration trail' })
    await page.getByRole('button', { name: 'Instruments' }).click()
    const instruments = page.getByRole('complementary', { name: 'Instruments' })
    await instruments.waitFor()
    await instruments.getByRole('button', { name: 'Press Check', exact: true }).click()
    await instruments.getByRole('button', { name: 'Turn off Press Check' }).waitFor()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    const inspector = page.getByRole('complementary', { name: 'Inspector' })
    await inspector.getByText('Press Check', { exact: true }).waitFor()
    const body = await page.locator('body').innerText()
    if (!body.includes('Ink spread')) fail('Ink spread slider missing')
    if (!body.includes('Misregistration')) fail('Misregistration slider missing')
    if (!body.includes('Paper tooth')) fail('Paper tooth slider missing')
    await trail.getByRole('button', { name: /Turned on Press Check/ }).waitFor()
    await capture(page, outDir, 'treatments')
    await page.getByRole('button', { name: 'Undo' }).click()
    await inspector.getByText('Press Check', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Commands' }).click()
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.waitFor()
    await palette.getByPlaceholder(/Search actions/).fill('Press Check')
    await palette.getByRole('button', { name: /^Press Check$/ }).click()
    await inspector.getByText('Press Check', { exact: true }).waitFor()
    await inspector.getByRole('button', { name: 'Re-roll seed' }).first().click()
    await inspector.getByRole('button', { name: 'Bypass' }).first().click()
    await inspector.locator('li.bypassed').filter({ hasText: 'Press Check' }).waitFor()
    await capture(page, outDir, 'commands')
  },

  async 'instrument-assets'(page, outDir) {
    const trail = page.getByRole('region', { name: 'Exploration trail' })
    await openTab(page, 'Layers')
    await layerSelect(page, 'Oversized headline').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    const instruments = page.getByRole('complementary', { name: 'Instruments' })
    await instruments.waitFor()
    await instruments.getByRole('button', { name: /Copy selected/ }).click()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    const inspector = page.getByRole('complementary', { name: 'Inspector' })
    await inspector.getByText(/Xerox/).waitFor()
    await inspector.getByRole('button', { name: 'Save as instrument' }).click()
    await openTab(page, 'Assets')
    await inspector.getByRole('heading', { name: 'Instruments', exact: true }).waitFor()
    await inspector.getByRole('button', { name: 'Play instrument Mark' }).waitFor()
    await capture(page, outDir, 'assets')
    await openTab(page, 'Layers')
    await layerSelect(page, 'Red interruption').click()
    await page.getByRole('button', { name: 'Instruments' }).click()
    await instruments.waitFor()
    await instruments.getByRole('button', { name: 'Play instrument Mark' }).click()
    await page.getByRole('button', { name: 'Move tool' }).click()
    await openTab(page, 'Treatments')
    await inspector.getByText(/Xerox/).waitFor()
    const empty = inspector.getByText('No layer treatments yet')
    if (await empty.isVisible()) fail('Replay did not apply the saved instrument')
    await trail.getByRole('button', { name: /Played Mark/ }).waitFor()
    await capture(page, outDir, 'replay')
    await page.getByRole('button', { name: 'Undo' }).click()
    await inspector.getByText('No layer treatments yet').waitFor()
    await page.getByRole('button', { name: 'Commands' }).click()
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.waitFor()
    await palette.getByPlaceholder(/Search actions/).fill('Mark')
    await palette.getByRole('button', { name: 'Play instrument Mark' }).click()
    await inspector.getByText(/Xerox/).waitFor()
    await capture(page, outDir, 'commands')
  },

  async 'bezier-pen'(page, outDir) {
    await page.getByRole('button', { name: 'Shape tool' }).click()
    await page.getByRole('menuitem', { name: 'Pen', exact: true }).click()
    await page.getByRole('status').filter({ hasText: /click to place/i }).waitFor()
    await capture(page, outDir, 'pen-on')
    const workspace = page.getByRole('application', { name: /Poster canvas workspace/ })
    await workspace.click({ position: { x: 240, y: 200 } })
    await workspace.click({ position: { x: 420, y: 160 } })
    await workspace.click({ position: { x: 380, y: 340 } })
    await page.keyboard.press('Enter')
    await page.getByRole('status').filter({ hasText: /bezier path/i }).waitFor()
    await openTab(page, 'Layers')
    await layerSelect(page, 'Pen stroke').waitFor()
    await capture(page, outDir, 'after-path')
  },

  async 'cmyk-plates'(page, outDir) {
    await openTab(page, 'Print')
    const exportPlates = page.getByRole('button', { name: 'Export CMYK plates' })
    await exportPlates.waitFor()
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
    await exportPlates.click()
    const download = await downloadPromise
    const suggested = download.suggestedFilename()
    if (!suggested.endsWith('-plates.pdf')) fail(`Plate export was "${suggested}"`)
    await download.saveAs(join(outDir, suggested))
    await writeFile(join(outDir, 'download.txt'), `${suggested}\n`)
    await page.getByRole('status').filter({ hasText: /CMYK plates/i }).waitFor()
    await capture(page, outDir, 'after-plates')
    await page.getByRole('button', { name: 'Commands' }).click()
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.waitFor()
    await palette.getByPlaceholder(/Search actions/).fill('plates')
    await palette.getByRole('button', { name: 'Export CMYK plates' }).waitFor()
    await capture(page, outDir, 'commands')
    await page.keyboard.press('Escape')
  },

  async 'new-open'(page, outDir) {
    const home = page.getByRole('region', { name: 'Home' })
    await home.waitFor({ state: 'visible' })
    await page.getByText('No saved posters yet.').waitFor()
    await page.getByRole('button', { name: 'New poster', exact: true }).waitFor()
    await page.keyboard.press('Control+o')
    const openEmpty = page.getByRole('dialog', { name: 'Open poster' })
    await openEmpty.waitFor()
    await openEmpty.getByText('No saved posters yet.').waitFor()
    await capture(page, outDir, 'open-empty')
    await openEmpty.getByRole('button', { name: 'Cancel' }).click()
    await openEmpty.waitFor({ state: 'hidden' })

    await page.getByRole('button', { name: 'New poster', exact: true }).click()
    const newDialog = page.getByRole('dialog', { name: 'New poster' })
    await newDialog.waitFor()
    await newDialog.getByRole('option', { name: /Instagram portrait/ }).click()
    await newDialog.getByRole('button', { name: 'Create poster' }).click()
    await page.getByRole('region', { name: 'Poster canvas' }).waitFor({ state: 'visible' })
    await openTab(page, 'Layers')
    if (await layerSelect(page, 'Oversized headline').count()) {
      fail('New poster seeded the RAY GUN demo instead of a blank file')
    }
    await capture(page, outDir, 'blank-new')
    await page.getByRole('textbox', { name: 'Project name' }).fill('Night bus')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('status').filter({ hasText: /Saved/ }).waitFor()

    await page.getByRole('button', { name: 'New poster', exact: true }).click()
    await newDialog.waitFor()
    await newDialog.getByRole('option', { name: /Square/ }).click()
    await newDialog.getByRole('button', { name: 'Create poster' }).click()
    await page.getByRole('status').filter({ hasText: 'Started a new poster' }).waitFor()
    await page.getByRole('button', { name: 'Shape tool' }).click()
    await page.getByRole('menuitem', { name: 'Block' }).click()
    await page.getByRole('status').filter({ hasText: 'Added block' }).waitFor()

    await page.getByRole('button', { name: 'Open poster', exact: true }).click()
    const openDialog = page.getByRole('dialog', { name: 'Open poster' })
    await openDialog.waitFor()
    await openDialog.getByRole('button', { name: 'Open Night bus' }).click()
    const unsaved = page.getByRole('dialog', { name: 'Unsaved changes' })
    await unsaved.waitFor()
    await capture(page, outDir, 'unsaved-open')
    await unsaved.getByRole('button', { name: 'Cancel' }).click()
    await unsaved.waitFor({ state: 'hidden' })
    await openDialog.waitFor()
    await page.getByRole('region', { name: 'Poster canvas' }).waitFor()

    await openDialog.getByRole('button', { name: 'Open Night bus' }).click()
    await unsaved.waitFor()
    await unsaved.getByRole('button', { name: "Don't save" }).click()
    await page.getByRole('status').filter({ hasText: 'Loaded Night bus' }).waitFor()
    await capture(page, outDir, 'opened-poster')

    await page.getByRole('button', { name: 'Shape tool' }).click()
    await page.getByRole('menuitem', { name: 'Block' }).click()
    await page.getByRole('button', { name: 'New poster', exact: true }).click()
    await newDialog.waitFor()
    await newDialog.getByRole('button', { name: 'Create poster' }).click()
    await unsaved.waitFor()
    await capture(page, outDir, 'unsaved-new')
    await unsaved.getByRole('button', { name: "Don't save" }).click()
    await page.getByRole('status').filter({ hasText: 'Started a new poster' }).waitFor()
    await openTab(page, 'Layers')
    if (await layerSelect(page, 'Oversized headline').count()) {
      fail('New after discard still showed the seed poster')
    }
  },
}

const args = parseArgs(process.argv.slice(2))
const feature = args.feature
const runDir = args['run-dir'] || process.env.CARSON_VERIFY_RUN_DIR
if (!feature) fail('Pass --feature <id>')
if (!runDir) fail('Pass --run-dir or set CARSON_VERIFY_RUN_DIR')
if (!FEATURES[feature]) fail(`Unknown feature "${feature}". See features/README.md`)

const run = JSON.parse(await readFile(join(runDir, 'run.json'), 'utf8'))
const outDir = resolve(args.out || join(skillDir, 'artifacts', feature))
await mkdir(outDir, { recursive: true })

const browser = await chromium.launchPersistentContext(join(runDir, 'chrome'), {
  headless: args.headless !== '0',
  viewport: { width: 1440, height: 900 },
})
const page = browser.pages()[0] ?? (await browser.newPage())

try {
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'prompt') void dialog.accept('Mark')
    else void dialog.dismiss()
  })
  await page.goto(run.url, { waitUntil: 'domcontentloaded' })
  if (feature !== 'wreck-this-poster') await dismissOnboarding(page)
  if (feature !== 'wreck-this-poster' && feature !== 'home-recents' && feature !== 'new-open') await enterEditorFromHome(page)
  await FEATURES[feature](page, outDir)
  await writeFile(join(outDir, 'meta.json'), JSON.stringify({ feature, url: run.url, runId: run.runId }, null, 2))
  console.log(`ok feature=${feature} out=${outDir}`)
} catch (error) {
  await capture(page, outDir, 'failure').catch(() => undefined)
  throw error
} finally {
  await browser.close()
}
