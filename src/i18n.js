/* Display-only localization. Raw task data and saved progress stay language-neutral. */
(function (root) {
  'use strict';
  const KEY = 'threat-hunting-room.language.v1';
  let language = 'ja';
  try { if (root.localStorage?.getItem(KEY) === 'en') language = 'en'; } catch (_) { /* Storage is optional. */ }
  const dictionaryNode = root.document?.getElementById('translation-data');
  const dictionary = dictionaryNode ? JSON.parse(dictionaryNode.textContent) : {};
  const originals = new WeakMap(), attributes = new WeakMap();
  const sourceNames={'通信':'Network','認証':'Authentication','端末':'Endpoint','業務':'Business','収集':'Collection','ファイル':'File'};
  function sourceName(value){const original=String(value),key=original.trim();return language==='en'&&sourceNames[key]?original.replace(key,sourceNames[key]+' ('+key+')'):original;}
  const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Longest matches win. Single-character particles are never substituted inside prose.
  const phrases = Object.keys(dictionary).filter(key => key.length >= 2).sort((a,b) => b.length-a.length);
  const pattern = phrases.length ? new RegExp(phrases.map(escapePattern).join('|'), 'g') : null;
  function text(value) {
    const original = String(value == null ? '' : value);
    if (language !== 'en') return original;
    const progress=original.match(/^保存されている進捗：([0-9]+)タスク（採点条件達成：([0-9]+)件）$/);
    if(progress)return 'Saved progress: '+progress[1]+' task'+(progress[1]==='1'?'':'s')+' (grading requirements met: '+progress[2]+').';
    const fieldError=original.match(/^「([^」]+)」の後に値を入力してください。$/);
    if(fieldError)return 'Enter a value after “'+fieldError[1]+'”.';
    const dateError=original.match(/^「([^」]+)」には実在する日付をYYYY-MM-DDで指定してください（UTC・当日を含む）。$/);
    if(dateError)return 'For “'+dateError[1]+'”, enter a valid YYYY-MM-DD date (UTC, inclusive).';
    const sources=original.match(/^(不足：|過剰：)([^。]+)。(.*)$/s);
    if(sources&&sources[2].split('、').every(name=>sourceNames[name]))return (sources[1]==='不足：'?'Missing: ':'Extra: ')+sources[2].split('、').map(sourceName).join(', ')+'. '+text(sources[3]);
    if (Object.hasOwn(dictionary, original)) return dictionary[original];
    const trimmed = original.trim();
    if (Object.hasOwn(dictionary, trimmed)) return original.slice(0,original.indexOf(trimmed))+dictionary[trimmed]+original.slice(original.indexOf(trimmed)+trimmed.length);
    const chapter=original.match(/^(.+)の([0-9]+)タスク$/);
    if(chapter)return text(chapter[1])+' — '+chapter[2]+' tasks';
    let translated = pattern ? original.replace(pattern, match => dictionary[match]) : original;
    translated = translated.replace(/([\d,]+)行/g,'$1 records').replace(/([\d,]+)件/g,'$1 records').replace(/([\d,–—-]+)分/g,'$1 min');
    return translated;
  }
  const protectedSelector = 'script,style,noscript,textarea,input,code,pre:not([data-i18n-example]),[data-i18n-raw="true"],.validation-records article,.evidence-item h3,.log h3,.log > p,.timeline-item h3,.timeline-item > p';
  function apply(scope) {
    const doc = root.document;
    if (!scope || !doc?.createTreeWalker || !scope.querySelectorAll) return;
    const walker = doc.createTreeWalker(scope,4); // SHOW_TEXT; independent of NodeFilter globals.
    let node;
    while ((node=walker.nextNode())) {
      if (!node.parentElement || node.parentElement.closest(protectedSelector)) continue;
      const sourceContext=node.parentElement.closest('[data-i18n-source],select[data-filter="source"] option:not([value=""]),#compare-source option:not([value=""])') || (node.parentElement.matches?.('label')&&node.parentElement.querySelector?.('[data-array="sources"]'));
      if (!originals.has(node)) originals.set(node,node.nodeValue);
      const original=originals.get(node);
      node.nodeValue=language==='en'?(sourceContext?sourceName(original):text(original)):original;
    }
    const elements=[scope,...scope.querySelectorAll('[aria-label],[title],[placeholder]')];
    for(const element of elements) {
      if (!element.getAttribute || element.closest?.('[data-i18n-raw="true"]')) continue;
      let values=attributes.get(element);if(!values){values={};attributes.set(element,values);}
      for(const name of ['aria-label','title','placeholder']) {
        if(!element.hasAttribute(name))continue;
        if(!Object.hasOwn(values,name))values[name]=element.getAttribute(name);
        element.setAttribute(name,language==='en'?text(values[name]):values[name]);
      }
    }
    for(const select of scope.querySelectorAll('[data-language]')) select.value=language;
    if(doc.documentElement)doc.documentElement.lang=language;
  }
  function setLanguage(value) {
    if(!['ja','en'].includes(value))return false;
    language=value;
    try {root.localStorage?.setItem(KEY,language);} catch (_) { /* Keep the preference for this session. */ }
    apply(root.document?.body);
    return true;
  }
  root.THI18n=Object.freeze({text,sourceName,apply,setLanguage,get language(){return language;},key:KEY});
})(typeof window==='undefined'?globalThis:window);
