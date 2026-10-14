/* EstateAI — AI Chatbot demo conversation engine.
   Fully client-side simulation. No network requests. */

(function () {
  'use strict';

  var msgsEl = document.getElementById('chatMessages');
  var quickEl = document.getElementById('chatQuick');
  var form = document.getElementById('chatForm');
  var input = document.getElementById('chatInput');
  var bubble = document.getElementById('chatBubble');
  var win = document.getElementById('chatWindow');
  var closeBtn = document.getElementById('chatClose');

  var state = freshState();
  var started = false;
  var chatOpen = false;
  var awaitingQuick = false;

  function freshState() {
    return {
      step: 'intent',       // intent -> address -> proptype -> bedrooms -> timeline -> name -> phone -> slot -> done
      intent: null,         // selling | letting | valuation
      address: null,
      proptype: null,
      bedrooms: null,
      timeline: null,
      name: null,
      phone: null,
      slot: null
    };
  }

  /* ---------- DOM helpers ---------- */

  function scrollDown() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function addMsg(text, who) {
    var d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    msgsEl.appendChild(d);
    scrollDown();
  }

  function typingDelay() {
    return 900 + Math.random() * 700; // 900–1600ms
  }

  // Shows a typing indicator, then the bot message. Returns a Promise.
  function botSay(text) {
    return new Promise(function (resolve) {
      var t = document.createElement('div');
      t.className = 'msg bot typing';
      t.setAttribute('aria-hidden', 'true');
      t.innerHTML = '<span></span><span></span><span></span>';
      msgsEl.appendChild(t);
      scrollDown();
      setTimeout(function () {
        t.remove();
        addMsg(text, 'bot');
        resolve();
      }, typingDelay());
    });
  }

  function setQuick(options) {
    quickEl.innerHTML = '';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'quick-btn';
      b.textContent = o.label;
      b.addEventListener('click', function () {
        onQuick(o);
      });
      quickEl.appendChild(b);
    });
    awaitingQuick = options.length > 0;
    scrollDown();
  }

  function clearQuick() {
    quickEl.innerHTML = '';
    awaitingQuick = false;
  }

  function ask(text, options) {
    return botSay(text).then(function () {
      setQuick(options || []);
    });
  }

  /* ---------- Option sets ---------- */

  function intents() {
    return [
      { label: 'Selling', value: 'selling' },
      { label: 'Letting', value: 'letting' },
      { label: 'Valuation', value: 'valuation' }
    ];
  }

  function proptypes() {
    return [
      { label: 'Terraced', value: 'terraced' },
      { label: 'Semi-detached', value: 'semi' },
      { label: 'Detached', value: 'detached' },
      { label: 'Flat', value: 'flat' }
    ];
  }

  function beds() {
    return [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
      { label: '3', value: '3' },
      { label: '4+', value: '4+' }
    ];
  }

  function timelines() {
    return [
      { label: 'ASAP', value: 'asap' },
      { label: 'Few months', value: 'months' },
      { label: 'Just curious', value: 'curious' }
    ];
  }

  function slots() {
    return [
      { label: 'Today 6–8pm', value: 'today' },
      { label: 'Tomorrow morning', value: 'tmrw-am' },
      { label: 'Tomorrow afternoon', value: 'tmrw-pm' }
    ];
  }

  /* ---------- Flow ---------- */

  function onQuick(o) {
    addMsg(o.label, 'user');
    clearQuick();
    handleAnswer(o.value, o.label);
  }

  function handleAnswer(value, label) {
    var s = state;
    if (s.step === 'intent') {
      s.intent = value;
      s.step = 'address';
      ask("Lovely — what's the property address?");
    } else if (s.step === 'proptype') {
      s.proptype = label;
      s.step = 'bedrooms';
      ask('How many bedrooms does it have?', beds());
    } else if (s.step === 'bedrooms') {
      s.bedrooms = label;
      s.step = 'timeline';
      ask('And roughly when are you looking to move?', timelines());
    } else if (s.step === 'timeline') {
      s.timeline = label;
      s.step = 'name';
      askValuationThenName();
    } else if (s.step === 'slot') {
      s.slot = label;
      s.step = 'done';
      finale();
    }
  }

  function askValuationThenName() {
    var what = state.intent === 'letting' ? 'rental appraisal' : 'valuation';
    botSay('Where should we send your ' + what + '?').then(function () {
      ask("What's your name?");
    });
  }

  function routeText(v) {
    var s = state;
    if (s.step === 'address') {
      if (v.length >= 3) {
        s.address = v;
        if (s.intent === 'letting') {
          s.step = 'bedrooms';
          ask('How many bedrooms does it have?', beds());
        } else {
          s.step = 'proptype';
          ask('What type of property is it?', proptypes());
        }
      } else {
        ask('Could you pop in the full property address?');
      }
    } else if (s.step === 'name') {
      if (v.length >= 2) {
        s.name = v;
        s.step = 'phone';
        ask('And your phone number, so the agent can reach you?');
      } else {
        ask("What's your name?");
      }
    } else if (s.step === 'phone') {
      var digits = v.replace(/\D/g, '');
      if (digits.length >= 7) {
        s.phone = v;
        s.step = 'slot';
        ask('When suits for the visit?', slots());
      } else {
        ask("That number looks a little short — could you double-check it?");
      }
    } else {
      fallback();
    }
  }

  function fallback() {
    botSay("Got it — I'll pass that to the team. Could you pick one of the options above so I book you in correctly?").then(function () {
      reshowQuick();
    });
  }

  // Re-render the quick replies for the current step (used after fallback / FAQ).
  function reshowQuick() {
    var s = state;
    if (s.step === 'intent') setQuick(intents());
    else if (s.step === 'proptype') setQuick(proptypes());
    else if (s.step === 'bedrooms') setQuick(beds());
    else if (s.step === 'timeline') setQuick(timelines());
    else if (s.step === 'slot') setQuick(slots());
    else {
      // Free-text step: re-ask the question instead.
      if (s.step === 'address') ask("What's the property address?");
      else if (s.step === 'name') ask("What's your name?");
      else if (s.step === 'phone') ask('And your phone number, so the agent can reach you?');
    }
  }

  /* ---------- FAQ (available anytime) ---------- */

  var faqAnswers = {
    fees: 'Our standard sales fee is 1% + VAT — no sale, no fee.',
    speed: 'Average 6–8 weeks from listing to offer in Manchester.'
  };

  Array.prototype.forEach.call(document.querySelectorAll('.faq-chip'), function (chip) {
    chip.addEventListener('click', function () {
      if (state.step === 'done') return;
      addMsg(chip.textContent.trim(), 'user');
      clearQuick();
      botSay(faqAnswers[chip.getAttribute('data-faq')] || '').then(function () {
        reshowQuick();
      });
    });
  });

  /* ---------- Finale ---------- */

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function finale() {
    var s = state;
    var rows = [
      ['Interested in', cap(s.intent)],
      ['Address', s.address]
    ];
    if (s.proptype) rows.push(['Property type', s.proptype]);
    rows.push(['Bedrooms', s.bedrooms]);
    rows.push(['Timeline', s.timeline]);
    rows.push(['Name', s.name]);
    rows.push(['Phone', s.phone]);

    var dl = rows.map(function (r) {
      return '<dt>' + escapeHtml(r[0]) + '</dt><dd>' + escapeHtml(r[1] || '—') + '</dd>';
    }).join('');

    var html =
      '<div class="summary">' +
        '<p class="summary-title">BOOKING SUMMARY</p>' +
        '<dl>' + dl + '</dl>' +
        '<p class="summary-ok">&#10003; Valuation booked for ' + escapeHtml(s.slot) + '</p>' +
        '<p class="summary-ok">&#10003; Agent notified instantly</p>' +
        '<button class="restart-btn" id="restartBtn" type="button">Start over</button>' +
      '</div>';

    botSay("All booked in! Here's what I've captured:").then(function () {
      var host = document.createElement('div');
      host.className = 'msg bot card-host';
      host.innerHTML = html;
      msgsEl.appendChild(host);
      scrollDown();
      document.getElementById('restartBtn').addEventListener('click', restart);
    });
  }

  function restart() {
    msgsEl.innerHTML = '';
    clearQuick();
    state = freshState();
    started = false;
    startFlow();
  }

  /* ---------- Open / close ---------- */

  function startFlow() {
    if (started) return;
    started = true;
    ask("Hi! Looking to sell, let, or just curious what your home's worth?", intents());
  }

  function openChat() {
    win.classList.add('open');
    win.setAttribute('aria-hidden', 'false');
    chatOpen = true;
    bubble.classList.remove('pulse');
    startFlow();
    setTimeout(scrollDown, 60);
  }

  function closeChat() {
    win.classList.remove('open');
    win.setAttribute('aria-hidden', 'true');
    chatOpen = false;
  }

  bubble.addEventListener('click', function () {
    if (chatOpen) closeChat();
    else openChat();
  });
  closeBtn.addEventListener('click', closeChat);

  document.getElementById('tryDemoBtn').addEventListener('click', openChat);
  document.getElementById('heroDemoBtn').addEventListener('click', openChat);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v) return;
    input.value = '';
    addMsg(v, 'user');
    if (awaitingQuick || state.step === 'done') {
      fallback();
      return;
    }
    routeText(v);
  });

  // Auto-open shortly after load, with a soft pulse on the bubble.
  setTimeout(function () {
    if (!chatOpen) {
      bubble.classList.add('pulse');
      openChat();
    }
  }, 4000);
})();
