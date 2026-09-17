#!/usr/bin/env node
// Builds data/course-manifest.json from index.html.
//
// The portal keeps every course's videos (template) and quiz (JS class) inline.
// The admin panel and the PHP API need a flat list of courses, so this script
// evaluates the portal's Component class with a stub base class, walks the
// template for each module's <video src> tags, and writes the result out.
//
// Usage:  node tools/build-course-manifest.mjs
// Re-run whenever index.html gains, removes, or renames a module or a video.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// ---- 1. Pull the template and the logic script out of the page -------------
const tplStart = html.indexOf('<x-dc>');
const tplEnd = html.lastIndexOf('</x-dc>');
if (tplStart < 0 || tplEnd < 0) throw new Error('index.html: <x-dc> template not found');
const template = html.slice(tplStart + '<x-dc>'.length, tplEnd);

const scriptOpen = html.indexOf('<script type="text/x-dc" data-dc-script');
if (scriptOpen < 0) throw new Error('index.html: data-dc-script block not found');
const scriptBodyStart = html.indexOf('>', scriptOpen) + 1;
const scriptBodyEnd = html.indexOf('</script>', scriptBodyStart);
const js = html.slice(scriptBodyStart, scriptBodyEnd);

// ---- 2. Evaluate the Component class with a minimal DCLogic stub -----------
class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(patch) { const p = typeof patch === 'function' ? patch(this.state) : patch; this.state = { ...this.state, ...p }; }
  forceUpdate() {}
  componentDidMount() {}
  componentDidUpdate() {}
  componentWillUnmount() {}
  renderVals() { return {}; }
}
// Browser globals that method bodies may touch when called outside a page.
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || { querySelector: () => null, getElementById: () => null };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };

const factory = new Function('DCLogic', 'StreamableLogic', 'React', js + '\n;return Component;');
const Component = factory(DCLogic, DCLogic, {});
const c = new Component({});

// ---- 3. Course list in the strict unlock order the hub uses ----------------
const procOrder = ['p1', 'p2', 'p4', 'p3', 'p5', 'p6', 'p7', 'p9', 'p10', 'p11'];
const processes = c.processData();
const processTitles = Object.fromEntries(processes.map((p) => [p.id, p.name]));
const sections = c.sectionsData();

const courses = [];
let order = 0;
for (const id of procOrder) {
  courses.push({ id, title: processTitles[id] || id, section: 'Our Process', sectionIndex: 0, kind: 'process', order: order++ });
}
sections.forEach((sec, si) => {
  for (const name of sec.modules) {
    const id = c.moduleIdFor(name);
    if (!id) { console.warn('No module id for', name); continue; }
    courses.push({ id, title: name, section: sec.name, sectionIndex: si + 1, kind: 'module', order: order++ });
  }
});

// ---- 4. Videos per course --------------------------------------------------
// Tactic modules: literal <video src="uploads/…"> inside the module's
// <sc-if value="{{ isXxxModule }}"> block. Process blocks p2+: video paths live
// in processContent() data. p1 has its own template block (isP1Module).
const flagToId = {};
for (const m of js.matchAll(/is([A-Za-z0-9]+)Module:\s*this\.state\.activeModule\s*===\s*'([a-z0-9]+)'/g)) {
  flagToId['is' + m[1] + 'Module'] = m[2];
}

function blockFor(flag) {
  const open = template.indexOf(`<sc-if value="{{ ${flag} }}"`);
  if (open < 0) return '';
  // Walk nested sc-if tags to find this block's closing tag.
  const re = /<sc-if\b|<\/sc-if>/g;
  re.lastIndex = open;
  let depth = 0;
  let m;
  while ((m = re.exec(template))) {
    if (m[0] === '<sc-if') depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return template.slice(open, m.index);
    }
  }
  return template.slice(open);
}

const VIDEO_RE = /uploads\/[^"'\s<>{}]+?\.(?:mp4|webm|m4v|mov)/gi;
function uniq(list) { return [...new Set(list)]; }

const videosByCourse = {};
for (const [flag, id] of Object.entries(flagToId)) {
  const block = blockFor(flag);
  const srcs = [];
  for (const m of block.matchAll(/<video\b[^>]*\bsrc="([^"]+)"/g)) srcs.push(decodeURIComponent(m[1]));
  videosByCourse[id] = uniq(srcs);
}
const processContent = c.processContent();
for (const id of procOrder) {
  if (videosByCourse[id] && videosByCourse[id].length) continue;
  const data = processContent[id];
  if (!data) continue;
  videosByCourse[id] = uniq((JSON.stringify(data).match(VIDEO_RE) || []).map((s) => s.replace(/\\\//g, '/')));
}

// ---- 5. Quiz per course ----------------------------------------------------
function quizFor(id) {
  c.state = { ...c.state, activeModule: id };
  let qs;
  try { qs = c.quizData(); } catch (e) { console.warn('quizData failed for', id, e.message); qs = []; }
  return (qs || []).map((q) => ({
    section: Number.isFinite(q.section) ? q.section : 0,
    text: String(q.text || ''),
    options: (q.options || []).map(String),
    correct: Number.isFinite(q.correct) ? q.correct : 0,
    why: String(q.why || ''),
  }));
}

function stepsFor(id) {
  c.state = { ...c.state, activeModule: id };
  try { const s = c.stepNames(); return Array.isArray(s) ? s.map(String) : []; } catch (e) { return []; }
}

for (const course of courses) {
  course.videos = (videosByCourse[course.id] || []).map((src) => ({ src }));
  course.steps = stepsFor(course.id);
  course.quiz = quizFor(course.id);
  course.type = course.videos.length > 0 ? 'video' : 'interactive';
}

// ---- 6. Narration allowlist ----------------------------------------------
// api/tts.php only synthesizes text that appears in a course script. Collect every
// narration segment the portal can ask for (per module and step) and store its hash.
import { createHash } from 'node:crypto';
const narrationHashes = new Set();
let narrationCount = 0;
for (const course of courses) {
  c.state = { ...c.state, activeModule: course.id };
  let steps = 8;
  try { steps = c.quizStep(); } catch (e) { /* keep default */ }
  for (let i = 0; i < steps; i++) {
    let segs = [];
    try { segs = c.segmentsFor(i) || []; } catch (e) { segs = []; }
    for (const s of segs) {
      const t = String(s && s.text || '');
      if (!t.trim()) continue;
      narrationHashes.add(createHash('sha1').update(t, 'utf8').digest('hex'));
      narrationCount++;
    }
  }
  if (course.id === 'gbp') {
    try { const t = String(c.scriptFor(0) || ''); if (t) narrationHashes.add(createHash('sha1').update(t, 'utf8').digest('hex')); } catch (e) { /* optional */ }
  }
}

// ---- 7. Write --------------------------------------------------------------
const manifest = {
  generatedAt: new Date().toISOString(),
  source: 'index.html',
  sections: ['Our Process', ...sections.map((s) => s.name)],
  narration_hashes: [...narrationHashes].sort(),
  courses,
};
mkdirSync(join(root, 'data'), { recursive: true });
const out = join(root, 'data', 'course-manifest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');

const withVideo = courses.filter((x) => x.videos.length).length;
const withQuiz = courses.filter((x) => x.quiz.length).length;
console.log(`Wrote ${out}`);
console.log(`${courses.length} courses · ${withVideo} with videos · ${withQuiz} with quizzes · ${narrationCount} narration segments (${narrationHashes.size} unique)`);
for (const x of courses) console.log(`  ${String(x.order).padStart(2)}  ${x.id.padEnd(7)} ${x.title.padEnd(30)} videos=${String(x.videos.length).padStart(2)} quiz=${String(x.quiz.length).padStart(2)}`);
