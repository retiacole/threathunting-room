'use strict';
const vm = require('node:vm');
const aliases = ['dist/index.html', 'index.html', 'threathunting-room.html', 'docs/index.html', 'docs/threathunting-room.html'];

function checkHtml(html) {
  const errors = [];
  if (!/^\s*<!doctype html>/i.test(html)) errors.push('Missing HTML document declaration.');
  if (!/<title>[^<]*ThreatHunting-room[^<]*<\/title>/i.test(html)) errors.push('Missing ThreatHunting-room page title.');
  if (/\/\* (?:STYLES|DATA|ENGINE|APP) \*\//.test(html)) errors.push('Unexpanded build placeholder.');
  const csp = html.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content="([^"]+)"/i);
  if (!csp || !/\bconnect-src\s+'none'\s*(?:;|$)/.test(csp[1]) || !/\bdefault-src\s+'none'\s*(?:;|$)/.test(csp[1])) errors.push('Offline CSP must include default-src and connect-src set to none.');
  if (/<(?:img|picture|svg|iframe|object|embed)\b/i.test(html) || /data:image\//i.test(html)) errors.push('Application HTML must not embed illustrations or external views. Keep character artwork in README.');
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=/i.test(html)) errors.push('External script/link dependency found.');
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(|navigator\.sendBeacon\s*\(/.test(html)) errors.push('Network API detected; review offline behavior.');
  if (/\burl\s*\(\s*["']?(?:https?:|\/\/|file:)/i.test(html) || /\b(?:src|srcset)\s*=\s*["'](?:https?:|\/\/|file:)/i.test(html)) errors.push('External resource reference found.');
  // Synthetic Windows paths such as C:/Users/analyst are lesson data, not macOS paths.
  if (/(?<![A-Za-z]:)\/Users\/[A-Za-z0-9._-]+/.test(html) || /file:\/\//i.test(html)) errors.push('Local user path detected.');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if (!scripts.length) errors.push('No inline application scripts found.');
  let bundle;
  for (const script of scripts) {
    try {
      if (/\btype=["']application\/json["']/i.test(script[1])) {
        const parsed = JSON.parse(script[2]);
        if (/\bid=["']task-data["']/i.test(script[1])) bundle = parsed;
      } else new vm.Script(script[2]);
    } catch (error) { errors.push(`Invalid inline script or JSON: ${error.message}`); }
  }
  if (!bundle || !Array.isArray(bundle.tasks) || !bundle.tasks.length) errors.push('Missing nonempty task-data bundle.');
  if (bundle && Array.isArray(bundle.tasks)) {
    const ids = bundle.tasks.map(task => task.id);
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) errors.push('Task IDs must be unique nonempty strings.');
  }
  return errors;
}

module.exports = {aliases, checkHtml};
