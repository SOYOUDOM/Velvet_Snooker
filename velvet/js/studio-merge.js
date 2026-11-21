/* VELVET — applies your VELVET Studio edits (characters/studio.js) on top of
   characters/characters.js and js/opponents.js. Those two files are never
   changed by the studio: delete characters/studio.js (or press "Reset all" in
   the studio) to get the original characters back. Also receives a character from the studio's "Test in game" button: the
   game page is opened with #studio-test and waits up to six seconds for it. */
(function () {
  'use strict';
  const man = window.VELVET_CHARACTERS || (window.VELVET_CHARACTERS = { animations: {}, people: [] });
  const opps = window.VELVET_OPPONENTS || (window.VELVET_OPPONENTS = []);
  const basePeople = man.people.slice(), baseOpps = opps.slice();
  const VS = { data: {}, links: { you: {}, two: {} }, test: null, ready: null, merge, basePeople, baseOpps };

  function merge(data, test) {
    data = data && typeof data === 'object' ? data : {};
    const hidden = new Set(data.hidden || []);
    const mine = new Map((data.people || []).filter((e) => e && e.id && e.model).map((e) => [e.id, e]));
    let list = basePeople.filter((e) => !hidden.has(e.id)).map((e) => mine.get(e.id) || e);
    for (const e of mine.values()) if (!basePeople.some((b) => b.id === e.id)) list.push(e);
    // The game takes the first referee, and the first two players, in list order.
    const first = (id) => { const i = list.findIndex((e) => e.id === id); if (i > 0) list.unshift(list.splice(i, 1)[0]); };
    if (data.two && data.two.character) first(data.two.character);
    if (data.you && data.you.character) first(data.you.character);
    if (data.referee) first(data.referee);
    if (test && test.role === 'referee') first(test.id);
    if (test && test.role === 'audience') list = list.filter((e) => e.role !== 'audience' || e.id === test.id);
    if (!list.some((e) => e.role === 'player')) list.push(...basePeople.filter((e) => e.role === 'player'));
    man.people.length = 0; man.people.push(...list);

    const mineO = new Map((data.opponents || []).filter((o) => o && o.id && o.name).map((o) => [o.id, o]));
    const ol = baseOpps.map((o) => mineO.get(o.id) || o);
    for (const o of mineO.values()) if (!baseOpps.some((b) => b.id === o.id)) ol.push(o);
    if (!ol.length) ol.push({ id: 'club', name: 'Club Bot', short: 'CLUB BOT', style: {} });
    opps.length = 0; opps.push(...ol);
    VS.data = data;
    VS.links = { you: data.you || {}, two: data.two || {} };
  }

  try { merge(window.VELVET_STUDIO); } catch (e) { console.warn('VELVET Studio file could not be applied:', e); merge({}); }

  if (!/(^|[#&])studio-test\b/.test(location.hash)) VS.ready = Promise.resolve();
  else {
    VS.ready = new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      window.addEventListener('message', (ev) => {
        const d = ev.data;
        if (done || !d || d.type !== 'velvet-studio-test') return;
        try {
          window.VELVET_FILES = Object.assign(window.VELVET_FILES || {}, d.files || {});
          VS.test = d.test || null;
          merge(d.studio || {}, VS.test);
        } catch (e) { console.warn('VELVET Studio test:', e); VS.test = null; }
        finish();
      });
      try { (window.opener || window.parent).postMessage({ type: 'velvet-studio-ready' }, '*'); } catch (e) { /* opened on its own */ }
      setTimeout(finish, 6000);
    });
  }
  window.VelvetStudio = VS;
})();
