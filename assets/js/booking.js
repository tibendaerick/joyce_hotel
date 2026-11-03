/* ==========================================================================
   Joyce Hotel: booking.js
   Loaded (after config.js and main.js) on index, booking and contact pages.

   Handles three forms, found by data attributes:
     [data-availability-form]  home page search widget (validates, then submits
                               as a GET to booking.html)
     [data-booking-form]       booking.html: strict validation, live UGX summary,
                               simulated reservation, WhatsApp / email delivery
     [data-contact-form]       contact.html: validation, WhatsApp / email delivery

   SIMULATOR NOW, REAL BOOKING ENGINE LATER
   All booking logic goes through ONE adapter with three methods that return
   Promises:
       checkAvailability(stay)                -> { available: boolean, message }
       calculateQuote(stay, extraIds)         -> quote object (see priceQuote)
       createReservation(data)                -> reservation record with .reference
   The simulator below fulfils them locally (always available, saves to
   localStorage). To go live, define window.JoyceBookingService with the same
   three methods BEFORE this script loads. No form or UI code needs to change.

   Money is UGX only (see config.js). Nothing here collects card details.
   ========================================================================== */
(function () {
  'use strict';

  var J = window.Joyce;
  if (!J) { console.error('Joyce: main.js must load before booking.js.'); return; }

  var CFG = J.cfg;
  var B = CFG.booking;
  var $ = J.$, $$ = J.$$, el = J.el;
  var STORAGE_KEY = 'joyce.reservations';

  /* ---------- Strict value helpers ---------- */
  function isInt(value) { return /^\d+$/.test(String(value === undefined || value === null ? '' : value).trim()); }
  function toInt(value) { return isInt(value) ? parseInt(String(value).trim(), 10) : NaN; }

  function clean(text, multiline) {
    var out = String(text === undefined || text === null ? '' : text);
    out = out.replace(multiline ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ');
    out = out.replace(/[<>]/g, '');
    return multiline ? out.replace(/[ \t]+/g, ' ').trim() : out.replace(/\s+/g, ' ').trim();
  }

  function validEmail(v) { return v.length <= 120 && /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(v); }
  function validPhone(v) {
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(v)) { return false; }
    var digits = v.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }
  function validName(v) {
    return v.length >= 2 && v.length <= 80 && /[A-Za-z\u00C0-\u024F]{2,}/.test(v) && !/[0-9_@#$%^&*=+\[\]{}|\\\/]/.test(v);
  }

  /* ---------- Occupancy limits ---------- */
  function limits(room, rooms) {
    var n = rooms >= 1 ? rooms : 1;
    var list = room ? [room] : CFG.rooms;
    function max(key) { return Math.max.apply(null, list.map(function (r) { return r[key]; })); }
    return { adults: max('maxAdults') * n, children: max('maxChildren') * n, guests: max('maxGuests') * n };
  }

  function overMessage(room, rooms, what, max) {
    if (room) {
      return 'The ' + room.name + ' allows up to ' + max + ' ' + what + ' for ' + rooms + (rooms === 1 ? ' room' : ' rooms') + '. Add rooms or choose a larger room.';
    }
    return 'We can host up to ' + max + ' ' + what + ' in one online booking. Please contact us for larger groups.';
  }

  /* ---------- Stay validation (shared by hero search and booking form) ----------
     v: { checkIn, checkOut, roomId, rooms, adults, children, childAges[] } as raw strings
     opts: { requireRoom: boolean, ages: boolean }   returns { fieldName: message } */
  function validateStay(v, opts) {
    var e = {};
    var today = J.todayISO();
    var inDate = J.parseISO(v.checkIn);
    var outDate = J.parseISO(v.checkOut);
    var nights = inDate && outDate ? J.nightsBetween(v.checkIn, v.checkOut) : 0;

    if (!v.checkIn) { e.checkIn = 'Select a check-in date.'; }
    else if (!inDate) { e.checkIn = 'Enter a valid check-in date.'; }
    else if (v.checkIn < today) { e.checkIn = 'Check-in cannot be in the past.'; }
    else if (J.nightsBetween(today, v.checkIn) > B.maxAdvanceDays) { e.checkIn = 'Bookings open up to ' + B.maxAdvanceDays + ' days ahead.'; }

    if (!v.checkOut) { e.checkOut = 'Select a check-out date.'; }
    else if (!outDate) { e.checkOut = 'Enter a valid check-out date.'; }
    else if (inDate && v.checkOut <= v.checkIn) { e.checkOut = 'Check-out must be after check-in.'; }
    else if (inDate && nights < B.minNights) { e.checkOut = 'The minimum stay is ' + B.minNights + (B.minNights === 1 ? ' night.' : ' nights.'); }
    else if (inDate && nights > B.maxNights) { e.checkOut = 'The maximum stay online is ' + B.maxNights + ' nights. For longer stays, please contact us.'; }

    var room = null;
    var rooms = B.maxRooms;
    if (opts.requireRoom) {
      room = J.getRoom(v.roomId);
      if (!room) { e.room = 'Select a room type.'; }
      if (!isInt(v.rooms)) { e.rooms = 'Enter a whole number of rooms.'; rooms = 1; }
      else {
        rooms = toInt(v.rooms);
        if (rooms < 1 || rooms > B.maxRooms) { e.rooms = 'Choose between 1 and ' + B.maxRooms + ' rooms.'; rooms = 1; }
      }
    }

    var lim = limits(room, rooms);
    var adults = NaN, children = NaN;

    if (!isInt(v.adults)) { e.adults = 'Enter a whole number of adults.'; }
    else {
      adults = toInt(v.adults);
      if (adults < 1) { e.adults = 'At least one adult is required.'; }
      else if (opts.requireRoom && adults < rooms) { e.adults = 'Each room needs at least one adult.'; }
      else if (adults > lim.adults) { e.adults = overMessage(room, rooms, 'adults', lim.adults); }
    }

    if (!isInt(v.children)) { e.children = 'Enter a whole number of children (0 if none).'; }
    else {
      children = toInt(v.children);
      if (children > lim.children) { e.children = overMessage(room, rooms, 'children', lim.children); }
    }

    if (!e.adults && !e.children && adults + children > lim.guests) {
      e.children = room
        ? 'The ' + room.name + ' sleeps up to ' + room.maxGuests + ' guests per room, ' + lim.guests + ' for ' + rooms + (rooms === 1 ? ' room' : ' rooms') + '. Add rooms or choose a larger room.'
        : 'We can host up to ' + lim.guests + ' guests in one online booking. Please contact us for larger groups.';
    }

    if (opts.ages && !e.children && children > 0) {
      var ages = v.childAges || [];
      var bad = false;
      for (var i = 0; i < children; i += 1) {
        var age = ages[i];
        if (age === undefined || age === '' || !isInt(age) || toInt(age) > B.maxChildAge) { bad = true; }
      }
      if (bad) { e.childAges = 'Select the age of every child (0 to ' + B.maxChildAge + ').'; }
    }
    return e;
  }

  function validateGuest(v, opts) {
    var e = {};
    if (!v.fullName) { e.fullName = 'Enter your full name.'; }
    else if (!validName(v.fullName)) { e.fullName = 'Enter a valid name using letters only.'; }

    if (!v.email) { e.email = 'Enter your email address.'; }
    else if (!validEmail(v.email)) { e.email = 'Enter a valid email address, for example name@example.com.'; }

    if (!v.phone) { if (opts.phoneRequired) { e.phone = 'Enter a phone or WhatsApp number.'; } }
    else if (!validPhone(v.phone)) { e.phone = 'Enter a valid phone number, for example +256 700 000 000.'; }

    if (opts.mode === 'booking') {
      if (v.arrivalTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.arrivalTime)) { e.arrivalTime = 'Enter a valid arrival time.'; }
      if (v.requests && v.requests.length > 500) { e.requests = 'Special requests can be up to 500 characters.'; }
      if (!v.accept) { e.accept = 'Please accept the terms and the refund policy to continue.'; }
    } else {
      if (!v.topic || opts.topics.indexOf(v.topic) === -1) { e.topic = 'Choose a topic.'; }
      if (!v.message || v.message.length < 10) { e.message = 'Please write at least 10 characters.'; }
      else if (v.message.length > 1000) { e.message = 'Messages can be up to 1000 characters.'; }
      if (!v.consent) { e.consent = 'Please agree so we can reply to your message.'; }
    }
    return e;
  }

  /* ---------- Pricing (UGX, whole shillings) ---------- */
  function priceQuote(stay, extraIds) {
    var room = J.getRoom(stay.roomId);
    var nights = J.nightsBetween(stay.checkIn, stay.checkOut);
    var people = stay.adults + stay.children;
    var roomTotal = room.price * stay.rooms * nights;
    var lines = [];
    var extrasTotal = 0;
    CFG.extras.forEach(function (x) {
      if (extraIds.indexOf(x.id) === -1) { return; }
      var amount = x.per === 'person-night' ? x.price * people * nights : x.price;
      extrasTotal += amount;
      lines.push({ id: x.id, label: x.label, amount: amount });
    });
    var subtotal = roomTotal + extrasTotal;
    var tax = Math.round(subtotal * B.taxPercent / 100);
    var total = subtotal + tax;
    return {
      currency: B.currency, nights: nights, roomRate: room.price, roomTotal: roomTotal,
      extras: lines, extrasTotal: extrasTotal, subtotal: subtotal,
      taxPercent: B.taxPercent, tax: tax, total: total,
      depositPercent: B.depositPercent, deposit: Math.round(total * B.depositPercent / 100)
    };
  }

  /* ---------- Simulator service (swap for a real engine later) ---------- */
  var memoryStore = [];

  function loadAll() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) { return memoryStore.slice(); }
  }

  function saveAll(list) {
    memoryStore = list.slice();
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (err) { console.warn('Joyce: reservation saved in memory only (storage unavailable).'); }
  }

  function makeReference() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var bytes = null;
    try { bytes = window.crypto.getRandomValues(new Uint8Array(4)); } catch (err) { bytes = null; }
    var out = '';
    for (var i = 0; i < 4; i += 1) {
      var n = bytes ? bytes[i] : Math.floor(Math.random() * 256);
      out += chars.charAt(n % chars.length);
    }
    return 'JH-' + J.todayISO().replace(/-/g, '') + '-' + out;
  }

  var SimulatorService = {
    checkAvailability: function () { return Promise.resolve({ available: true, message: '' }); },
    calculateQuote: function (stay, extraIds) { return Promise.resolve(priceQuote(stay, extraIds)); },
    createReservation: function (data) {
      var record = Object.assign({ reference: makeReference(), createdAt: new Date().toISOString(), status: 'simulated-request' }, data);
      saveAll(loadAll().concat([record]).slice(-50));
      return Promise.resolve(record);
    },
    list: loadAll
  };
  var Service = window.JoyceBookingService || SimulatorService;

  /* ---------- Messages (WhatsApp and email share one structure) ---------- */
  function fm(n) { return J.formatMoney(n); }

  function fmtDate(iso) {
    var d = J.parseISO(iso);
    if (!d) { return iso; }
    try { return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d); }
    catch (err) { return iso; }
  }

  function guestsText(stay) {
    var parts = [stay.adults + (stay.adults === 1 ? ' adult' : ' adults')];
    if (stay.children > 0) {
      parts.push(stay.children + (stay.children === 1 ? ' child (age ' : ' children (ages ') + stay.childAges.join(', ') + ')');
    }
    return parts.join(', ');
  }

  function bookingParts(rec) {
    var s = rec.stay, g = rec.guest, q = rec.quote;
    var stayLines = [
      'Room: ' + s.roomName + ' x ' + s.rooms,
      'Check-in: ' + fmtDate(s.checkIn) + ' (from ' + CFG.hotel.checkInTime + ')',
      'Check-out: ' + fmtDate(s.checkOut) + ' (by ' + CFG.hotel.checkOutTime + ')',
      'Nights: ' + q.nights,
      'Guests: ' + guestsText(s)
    ];
    if (g.arrivalTime) { stayLines.push('Expected arrival: ' + g.arrivalTime); }
    var priceLines = ['Rooms: ' + fm(q.roomTotal)];
    q.extras.forEach(function (x) { priceLines.push(x.label + ': ' + fm(x.amount)); });
    priceLines.push('Tax (' + q.taxPercent + '%): ' + fm(q.tax));
    priceLines.push('Total: ' + fm(q.total));
    priceLines.push('Deposit due on confirmation (' + q.depositPercent + '%): ' + fm(q.deposit));
    return {
      heading: 'Reservation request: ' + CFG.hotel.name,
      intro: ['Reference: ' + rec.reference],
      sections: [
        { title: 'Guest', lines: ['Name: ' + g.fullName, 'Phone: ' + g.phone, 'Email: ' + g.email] },
        { title: 'Stay', lines: stayLines },
        { title: 'Price (' + q.currency + ')', lines: priceLines },
        { title: 'Special requests', lines: [rec.requests || 'None'] }
      ],
      footer: [
        'I accept the terms of service and the refund and cancellation policy.',
        'Sent from the website booking form. This is a request and is not confirmed until the hotel replies.'
      ]
    };
  }

  function contactParts(c) {
    var lines = ['Topic: ' + c.topic, 'Name: ' + c.fullName, 'Email: ' + c.email];
    if (c.phone) { lines.push('Phone: ' + c.phone); }
    return {
      heading: 'Website message: ' + CFG.hotel.name,
      intro: [],
      sections: [{ title: 'Details', lines: lines }, { title: 'Message', lines: [c.message] }],
      footer: ['Sent from the website contact form.']
    };
  }

  function renderMessage(style, parts) {
    var nl = style === 'email' ? '\r\n' : '\n';
    var out = [];
    function push(line) { out.push(String(line).replace(/\r?\n/g, nl)); }
    function bold(text) { return style === 'email' ? text : '*' + text + '*'; }
    push(bold(parts.heading));
    (parts.intro || []).forEach(push);
    parts.sections.forEach(function (sec) {
      push('');
      push(bold(sec.title.toUpperCase()));
      sec.lines.forEach(push);
    });
    if (parts.footer && parts.footer.length) { push(''); parts.footer.forEach(push); }
    return out.join(nl).replace(/\u00a0/g, ' ');
  }

  function channelUrl(channel, text, subject) {
    if (channel === 'email') {
      return 'mailto:' + CFG.hotel.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    }
    return 'https://wa.me/' + J.digits(CFG.hotel.whatsapp) + '?text=' + encodeURIComponent(text);
  }

  function copyText(text) {
    function fallback() {
      var area = el('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;left:-9999px;top:0;' });
      area.value = text;
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      area.remove();
      J.toast(ok ? 'Message copied.' : 'Copy failed. Please copy the message manually.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { J.toast('Message copied.'); }, fallback);
    } else { fallback(); }
  }

  /* ---------- Form utilities ---------- */
  function field(form, name) {
    var node = form.elements.namedItem(name);
    return node && node.value !== undefined ? node.value : '';
  }

  function controlsFor(form, name) {
    if (name === 'childAges') { return []; }
    return $$('[name="' + name + '"]', form);
  }

  function setError(form, name, message) {
    var slot = $('[data-error-for="' + name + '"]', form);
    if (slot) { slot.textContent = message || ''; }
    controlsFor(form, name).forEach(function (control) {
      if (message) { control.setAttribute('aria-invalid', 'true'); } else { control.removeAttribute('aria-invalid'); }
      var wrap = control.closest('.field');
      if (wrap) { wrap.classList.toggle('has-error', !!message); }
    });
  }

  function flagChildSelects(form, show) {
    $$('[name^="childAge"]', form).forEach(function (select) {
      var value = select.value;
      var invalid = show && (value === '' || !isInt(value) || toInt(value) > B.maxChildAge);
      if (invalid) { select.setAttribute('aria-invalid', 'true'); } else { select.removeAttribute('aria-invalid'); }
      var wrap = select.closest('.field');
      if (wrap) { wrap.classList.toggle('has-error', !!invalid); }
    });
  }

  function showAlert(form, type, content) {
    var box = $('[data-form-alert]', form);
    if (!box) { return; }
    box.textContent = '';
    box.className = 'form-alert form-alert--' + type;
    box.setAttribute('tabindex', '-1');
    (Array.isArray(content) ? content : [content]).forEach(function (part) {
      box.appendChild(typeof part === 'string' ? document.createTextNode(part) : part);
    });
    try { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { /* older browsers */ }
  }

  function hideAlert(form) {
    var box = $('[data-form-alert]', form);
    if (box) { box.textContent = ''; box.className = 'form-alert hidden'; }
  }

  function focusFirstInvalid(form) {
    var bad = form.querySelector('[aria-invalid="true"]');
    if (!bad) { return; }
    bad.focus();
    try { bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { /* older browsers */ }
  }

  function guardNumberInputs(form) {
    $$('input[type="number"]', form).forEach(function (input) {
      input.addEventListener('keydown', function (e) {
        if (['e', 'E', '+', '-', '.', ','].indexOf(e.key) !== -1) { e.preventDefault(); }
      });
    });
  }

  function setBusy(form, busy) {
    $$('button[type="submit"]', form).forEach(function (btn) { btn.disabled = busy; });
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function setDateBounds(form) {
    var inEl = form.elements.namedItem('checkIn');
    var outEl = form.elements.namedItem('checkOut');
    if (!inEl || !outEl) { return; }
    var today = J.todayISO();
    inEl.min = today;
    inEl.max = J.addDays(today, B.maxAdvanceDays);
    var base = J.parseISO(inEl.value) ? inEl.value : today;
    outEl.min = J.addDays(base, B.minNights);
    outEl.max = J.addDays(base, B.maxNights);
  }

  function openWindow(url) {
    var w = null;
    try { w = window.open(url, '_blank'); if (w) { w.opener = null; } } catch (err) { w = null; }
    return w;
  }

  function deliveryActions(waText, mailText, waUrl, mailUrl) {
    return el('div', { class: 'send-actions mt-2' }, [
      el('a', { class: 'btn btn--whatsapp', href: waUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Open WhatsApp' }),
      el('a', { class: 'btn btn--primary', href: mailUrl, text: 'Open email' }),
      (function () {
        var btn = el('button', { class: 'btn btn--ghost', type: 'button', text: 'Copy message' });
        btn.addEventListener('click', function () { copyText(waText); });
        return btn;
      }())
    ]);
  }

  /* ---------- Home page availability widget ---------- */
  function initAvailabilityForm(form) {
    form.noValidate = true;
    guardNumberInputs(form);
    setDateBounds(form);

    var names = ['checkIn', 'checkOut', 'adults', 'children'];
    var touched = {};
    var lim = limits(null, B.maxRooms);
    var adultsEl = form.elements.namedItem('adults');
    var childrenEl = form.elements.namedItem('children');
    if (adultsEl) { adultsEl.max = lim.adults; }
    if (childrenEl) { childrenEl.max = lim.children; }

    function read() {
      return { checkIn: field(form, 'checkIn'), checkOut: field(form, 'checkOut'), adults: field(form, 'adults'), children: field(form, 'children') };
    }
    function run(markAll) {
      var errors = validateStay(read(), { requireRoom: false, ages: false });
      names.forEach(function (n) { if (markAll || touched[n]) { setError(form, n, errors[n] || ''); } });
      return errors;
    }
    function syncOut() {
      var inEl = form.elements.namedItem('checkIn');
      var outEl = form.elements.namedItem('checkOut');
      setDateBounds(form);
      if (inEl && outEl && J.parseISO(inEl.value) && !outEl.value) { outEl.value = J.addDays(inEl.value, B.minNights); }
    }

    form.addEventListener('change', function (e) {
      if (e.target && e.target.name) { touched[e.target.name] = true; }
      syncOut();
      run(false);
    });
    form.addEventListener('input', function () { run(false); });
    form.addEventListener('submit', function (e) {
      var errors = run(true);
      if (Object.keys(errors).length) {
        e.preventDefault();
        showAlert(form, 'error', 'Please check the highlighted fields.');
        focusFirstInvalid(form);
      } else { hideAlert(form); }
    });
  }

  /* ---------- Booking form ---------- */
  function initBookingForm(form) {
    form.noValidate = true;
    guardNumberInputs(form);

    var STAY_FIELDS = ['checkIn', 'checkOut', 'room', 'rooms', 'adults', 'children', 'childAges'];
    var GUEST_FIELDS = ['fullName', 'email', 'phone', 'arrivalTime', 'requests', 'accept'];
    var touched = {};
    var summaryBox = $('[data-summary]', form);
    var hint = $('[data-occupancy-hint]', form);
    var agesWrap = $('[data-child-ages-wrap]', form);
    var agesBox = $('[data-child-ages]', form);
    var latest = 0;
    var lastSig = null;
    var lastRec = null;

    function readExtras() {
      var valid = CFG.extras.map(function (x) { return x.id; });
      return $$('input[name="extras"]:checked', form).map(function (c) { return c.value; }).filter(function (id) { return valid.indexOf(id) !== -1; });
    }

    function readStay() {
      var count = toInt(field(form, 'children'));
      var ages = $$('[name^="childAge"]', form).map(function (s) { return s.value; });
      return {
        checkIn: field(form, 'checkIn'), checkOut: field(form, 'checkOut'), roomId: field(form, 'room'),
        rooms: field(form, 'rooms'), adults: field(form, 'adults'), children: field(form, 'children'),
        childAges: isNaN(count) ? [] : ages.slice(0, count)
      };
    }

    function readGuest() {
      return {
        fullName: clean(field(form, 'fullName')), email: clean(field(form, 'email')), phone: clean(field(form, 'phone')),
        arrivalTime: clean(field(form, 'arrivalTime')), requests: clean(field(form, 'requests'), true),
        accept: !!(form.elements.namedItem('accept') || {}).checked
      };
    }

    function normalize(raw) {
      var room = J.getRoom(raw.roomId);
      return {
        checkIn: raw.checkIn, checkOut: raw.checkOut, roomId: room.id, roomName: room.name,
        rooms: toInt(raw.rooms), adults: toInt(raw.adults), children: toInt(raw.children),
        childAges: raw.childAges.map(toInt)
      };
    }

    function renderChildAges() {
      var count = toInt(field(form, 'children'));
      var max = limits(J.getRoom(field(form, 'room')), toInt(field(form, 'rooms')) || 1).children;
      if (isNaN(count) || count < 0 || count > max) { count = 0; }
      var previous = $$('[name^="childAge"]', form).map(function (s) { return s.value; });
      agesBox.textContent = '';
      for (var i = 0; i < count; i += 1) {
        var select = el('select', { id: 'b-childAge' + (i + 1), name: 'childAge' + (i + 1) });
        select.appendChild(el('option', { value: '', text: 'Age' }));
        for (var a = 0; a <= B.maxChildAge; a += 1) { select.appendChild(el('option', { value: String(a), text: a === 1 ? '1 year' : a + ' years' })); }
        if (previous[i] !== undefined) { select.value = previous[i]; }
        agesBox.appendChild(el('div', { class: 'field' }, [el('label', { for: 'b-childAge' + (i + 1), text: 'Child ' + (i + 1) }), select]));
      }
      if (agesWrap) { agesWrap.classList.toggle('hidden', count === 0); }
    }

    function syncLimits() {
      var room = J.getRoom(field(form, 'room'));
      var rooms = toInt(field(form, 'rooms')) || 1;
      var lim = limits(room, rooms);
      var adultsEl = form.elements.namedItem('adults');
      var childrenEl = form.elements.namedItem('children');
      var roomsEl = form.elements.namedItem('rooms');
      if (adultsEl) { adultsEl.max = lim.adults; }
      if (childrenEl) { childrenEl.max = lim.children; }
      if (roomsEl) { roomsEl.max = B.maxRooms; }
      if (hint) {
        hint.textContent = room
          ? 'The ' + room.name + ' sleeps up to ' + room.maxGuests + ' guests per room (max ' + room.maxAdults + ' adults and ' + room.maxChildren + ' children).'
          : 'Choose a room to see how many guests it sleeps.';
      }
    }

    function syncDates() {
      var inEl = form.elements.namedItem('checkIn');
      var outEl = form.elements.namedItem('checkOut');
      setDateBounds(form);
      if (inEl && outEl && J.parseISO(inEl.value) && !outEl.value) { outEl.value = J.addDays(inEl.value, B.minNights); }
    }

    function summaryMessage(text) {
      if (summaryBox) { summaryBox.textContent = ''; summaryBox.appendChild(el('p', { text: text })); }
    }

    function row(dl, label, value) { dl.appendChild(el('dt', { text: label })); dl.appendChild(el('dd', { text: value })); }

    function renderSummary(stay, q) {
      if (!summaryBox) { return; }
      var dl = el('dl');
      row(dl, 'Room', stay.roomName + ' x ' + stay.rooms);
      row(dl, 'Dates', fmtDate(stay.checkIn) + ' to ' + fmtDate(stay.checkOut));
      row(dl, 'Nights', String(q.nights));
      row(dl, 'Guests', guestsText(stay));
      row(dl, 'Rate', fm(q.roomRate) + ' per room, per night');
      row(dl, 'Rooms total', fm(q.roomTotal));
      q.extras.forEach(function (x) { row(dl, x.label, fm(x.amount)); });
      row(dl, 'Tax (' + q.taxPercent + '%)', fm(q.tax));
      summaryBox.textContent = '';
      summaryBox.appendChild(dl);
      summaryBox.appendChild(el('div', { class: 'total' }, [el('span', { text: 'Total' }), el('span', { text: fm(q.total) })]));
      summaryBox.appendChild(el('p', { class: 'field-hint', text: 'Deposit due on confirmation (' + q.depositPercent + '%): ' + fm(q.deposit) }));
    }

    function updateSummary(raw, errors) {
      var id = latest + 1;
      latest = id;
      var blocked = STAY_FIELDS.some(function (n) { return errors[n]; });
      if (blocked) { summaryMessage('Choose valid dates, a room and guest numbers to see your total.'); return; }
      var stay = normalize(raw);
      Service.calculateQuote(stay, readExtras()).then(function (q) {
        if (id === latest) { renderSummary(stay, q); }
      }).catch(function (err) {
        console.error('Joyce: quote failed', err);
        if (id === latest) { summaryMessage('We could not calculate the total just now. Please try again.'); }
      });
    }

    function refresh(markAll) {
      var raw = readStay();
      var stayErrors = validateStay(raw, { requireRoom: true, ages: true });
      var guestErrors = validateGuest(readGuest(), { mode: 'booking', phoneRequired: true });
      var all = Object.assign({}, stayErrors, guestErrors);
      STAY_FIELDS.concat(GUEST_FIELDS).forEach(function (n) {
        if (markAll || touched[n]) { setError(form, n, all[n] || ''); }
      });
      flagChildSelects(form, !!stayErrors.childAges && (markAll || touched.childAges));
      updateSummary(raw, stayErrors);
      return all;
    }

    function prefill() {
      var q;
      try { q = new URLSearchParams(window.location.search); } catch (err) { return; }
      var inVal = q.get('checkIn'), outVal = q.get('checkOut');
      if (J.parseISO(inVal)) { form.elements.namedItem('checkIn').value = inVal; }
      if (J.parseISO(outVal)) { form.elements.namedItem('checkOut').value = outVal; }
      if (isInt(q.get('adults')) && toInt(q.get('adults')) >= 1) { form.elements.namedItem('adults').value = toInt(q.get('adults')); }
      if (isInt(q.get('children'))) { form.elements.namedItem('children').value = toInt(q.get('children')); }
      if (isInt(q.get('rooms')) && toInt(q.get('rooms')) >= 1 && toInt(q.get('rooms')) <= B.maxRooms) { form.elements.namedItem('rooms').value = toInt(q.get('rooms')); }
      if (J.getRoom(q.get('room'))) { form.elements.namedItem('room').value = q.get('room'); }
    }

    function markTouched(target) {
      if (!target || !target.name) { return; }
      if (/^childAge/.test(target.name)) { touched.childAges = true; } else { touched[target.name] = true; }
    }

    form.addEventListener('change', function (e) {
      markTouched(e.target);
      syncDates();
      syncLimits();
      renderChildAges();
      refresh(false);
    });
    form.addEventListener('input', function (e) {
      if (e.target && (e.target.name === 'children' || e.target.name === 'rooms' || e.target.name === 'adults')) {
        syncLimits();
        if (e.target.name !== 'adults') { renderChildAges(); }
      }
      refresh(false);
    });
    form.addEventListener('focusout', function (e) { markTouched(e.target); refresh(false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAlert(form);
      var channel = (e.submitter && e.submitter.getAttribute('data-send')) || 'whatsapp';
      var errors = refresh(true);
      var count = Object.keys(errors).length;
      if (count) {
        showAlert(form, 'error', 'Please check the ' + count + (count === 1 ? ' highlighted field' : ' highlighted fields') + ' below.');
        focusFirstInvalid(form);
        return;
      }

      var popup = channel === 'whatsapp' ? openWindow('') : null;   /* opened now so it is allowed, filled after saving */
      var raw = readStay();
      var stay = normalize(raw);
      var guest = readGuest();
      var extras = readExtras();
      var requests = guest.requests;
      var guestData = { fullName: guest.fullName, email: guest.email, phone: guest.phone, arrivalTime: guest.arrivalTime };
      setBusy(form, true);

      Service.checkAvailability(stay).then(function (availability) {
        if (!availability || !availability.available) { throw new Error((availability && availability.message) || 'Those dates are not available.'); }
        return Service.calculateQuote(stay, extras);
      }).then(function (quote) {
        var signature = JSON.stringify([stay, guestData, extras, requests]);
        if (signature === lastSig && lastRec) { return lastRec; }
        return Service.createReservation({ stay: stay, guest: guestData, extras: extras, requests: requests, quote: quote }).then(function (rec) {
          lastSig = signature;
          lastRec = rec;
          return rec;
        });
      }).then(function (rec) {
        var parts = bookingParts(rec);
        var waText = renderMessage('whatsapp', parts);
        var mailText = renderMessage('email', parts);
        var subject = 'Reservation request ' + rec.reference + ': ' + rec.guest.fullName;
        var waUrl = channelUrl('whatsapp', waText, subject);
        var mailUrl = channelUrl('email', mailText, subject);
        var opened = false;
        if (channel === 'email') { window.location.href = mailUrl; opened = true; }
        else if (popup) { popup.location.href = waUrl; opened = true; }
        showAlert(form, 'success', [
          el('strong', { text: 'Reservation request ready. Reference: ' + rec.reference }),
          el('br'),
          opened
            ? 'Your message is opening in ' + (channel === 'email' ? 'your email app' : 'WhatsApp') + '. Please press send to submit it. If nothing opened, use the buttons below.'
            : 'Your browser blocked the new window. Use the buttons below to send your request.',
          deliveryActions(waText, mailText, waUrl, mailUrl)
        ]);
      }).catch(function (err) {
        if (popup) { try { popup.close(); } catch (closeErr) { /* ignore */ } }
        console.error('Joyce: reservation failed', err);
        showAlert(form, 'error', (err && err.message) ? err.message : 'Something went wrong. Please try again or contact us directly.');
      }).then(function () { setBusy(form, false); });
    });

    prefill();
    syncDates();
    syncLimits();
    renderChildAges();
    refresh(false);
  }

  /* ---------- Contact form ---------- */
  function initContactForm(form) {
    form.noValidate = true;
    var NAMES = ['fullName', 'email', 'phone', 'topic', 'message', 'consent'];
    var touched = {};
    var topicEl = form.elements.namedItem('topic');
    var topics = topicEl && topicEl.options ? Array.prototype.map.call(topicEl.options, function (o) { return o.value; }) : [];

    function read() {
      return {
        fullName: clean(field(form, 'fullName')), email: clean(field(form, 'email')), phone: clean(field(form, 'phone')),
        topic: clean(field(form, 'topic')), message: clean(field(form, 'message'), true),
        consent: !!(form.elements.namedItem('consent') || {}).checked
      };
    }
    function run(markAll) {
      var errors = validateGuest(read(), { mode: 'contact', phoneRequired: false, topics: topics });
      NAMES.forEach(function (n) { if (markAll || touched[n]) { setError(form, n, errors[n] || ''); } });
      return errors;
    }

    form.addEventListener('change', function (e) { if (e.target && e.target.name) { touched[e.target.name] = true; } run(false); });
    form.addEventListener('focusout', function (e) { if (e.target && e.target.name) { touched[e.target.name] = true; run(false); } });
    form.addEventListener('input', function () { run(false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAlert(form);
      var channel = (e.submitter && e.submitter.getAttribute('data-send')) || 'whatsapp';
      var errors = run(true);
      var count = Object.keys(errors).length;
      if (count) {
        showAlert(form, 'error', 'Please check the ' + count + (count === 1 ? ' highlighted field' : ' highlighted fields') + ' below.');
        focusFirstInvalid(form);
        return;
      }
      var data = read();
      var parts = contactParts(data);
      var waText = renderMessage('whatsapp', parts);
      var mailText = renderMessage('email', parts);
      var subject = 'Website enquiry: ' + data.topic;
      var waUrl = channelUrl('whatsapp', waText, subject);
      var mailUrl = channelUrl('email', mailText, subject);
      var opened = true;
      if (channel === 'email') { window.location.href = mailUrl; }
      else { opened = !!openWindow(waUrl); }
      showAlert(form, 'success', [
        el('strong', { text: 'Your message is ready.' }),
        el('br'),
        opened
          ? 'It is opening in ' + (channel === 'email' ? 'your email app' : 'WhatsApp') + '. Please press send. If nothing opened, use the buttons below.'
          : 'Your browser blocked the new window. Use the buttons below to send your message.',
        deliveryActions(waText, mailText, waUrl, mailUrl)
      ]);
    });
  }

  /* ---------- Boot ---------- */
  function guarded(fn) {
    return function (form) {
      try { fn(form); } catch (err) { console.error('Joyce: form setup failed', err); }
    };
  }

  J.whenReady(function () {
    $$('[data-availability-form]').forEach(guarded(initAvailabilityForm));
    $$('[data-booking-form]').forEach(guarded(initBookingForm));
    $$('[data-contact-form]').forEach(guarded(initContactForm));
  });

  /* Read-only hooks for testing and for plugging in a real engine later */
  window.JoyceBooking = Object.freeze({
    validateStay: validateStay, validateGuest: validateGuest, priceQuote: priceQuote,
    bookingParts: bookingParts, contactParts: contactParts, renderMessage: renderMessage,
    channelUrl: channelUrl, simulator: SimulatorService
  });
}());