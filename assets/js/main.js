/* ==========================================================================
   Joyce Hotel: main.js
   Shared behaviour for every page. Requires config.js to load first.

   PAGE CONTRACT (each page must follow this):
     <body>
       <div data-component="header"></div>      -> components/header.html
       <main id="main"> ... </main>
       <div data-component="footer"></div>      -> components/footer.html
       <script src="assets/js/config.js" defer></script>
       <script src="assets/js/main.js" defer></script>
       <script src="assets/js/booking.js" defer></script>   (booking pages only)

   HEADER CONTRACT (components/header.html):
     button.nav-toggle[aria-controls="nav-menu"][aria-expanded="false"]
     ul#nav-menu.nav-menu [data-render="nav-links"]

   DATA HOOKS (used in any HTML, including components):
     data-cfg="hotel.phone"        -> sets text from config.js
     data-link="phone|email|whatsapp|nexup|map|table|events" -> sets href from config.js
     data-render="nav-links|footer-links|policy-links|social|
                  featured-rooms|rooms|room-table|room-detail|amenities|reviews|
                  dining-outlets|menu|event-table|proximity|about-story|about-values|
                  room-options|extras
     iframe[data-map] -> src set to an embedded map of hotel.mapQuery"
       optional: data-limit="3" (rooms), data-filter="included|paid" (amenities)
     [data-room-tabs] -> filter tabs for the data-render="rooms" grid
     room-details.html: data-render="room-detail" reads ?room=<id>; also uses
       [data-room-title], [data-room-tagline], [data-other-rooms]

   Exposes window.Joyce (helpers also used by booking.js).
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.JOYCE_CONFIG;
  if (!CFG) {
    console.error('Joyce: config.js must load before main.js.');
    return;
  }

  /* ---------- Small helpers ---------- */
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function get(path) {
    return String(path).split('.').reduce(function (obj, key) {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, CFG);
  }

  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  /* Build DOM safely (no innerHTML with data). attrs: class, text, or any attribute. */
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var val = attrs[key];
      if (val === null || val === undefined || val === false) { return; }
      if (key === 'class') { node.className = val; }
      else if (key === 'text') { node.textContent = val; }
      else { node.setAttribute(key, val); }
    });
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined) { return; }
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function formatMoney(amount) {
    var number = Number(amount) || 0;
    try {
      return new Intl.NumberFormat(CFG.booking.locale, {
        style: 'currency', currency: CFG.booking.currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(number);
    } catch (err) {
      return CFG.booking.currency + ' ' + Math.round(number).toLocaleString('en-US');
    }
  }

  /* ---------- Date helpers (all dates are 'YYYY-MM-DD' strings) ---------- */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function toISO(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function todayISO() { return toISO(new Date()); }

  function parseISO(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) { return null; }
    var p = iso.split('-').map(Number);
    var date = new Date(p[0], p[1] - 1, p[2]);
    return toISO(date) === iso ? date : null;
  }

  function addDays(iso, days) {
    var date = parseISO(iso);
    if (!date) { return null; }
    date.setDate(date.getDate() + days);
    return toISO(date);
  }

  function nightsBetween(startISO, endISO) {
    var a = parseISO(startISO), b = parseISO(endISO);
    if (!a || !b) { return 0; }
    var ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    return Math.round(ms / 86400000);
  }

  function getRoom(id) {
    return CFG.rooms.filter(function (room) { return room.id === id; })[0] || null;
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(message) {
    try {
      var old = $('.toast');
      if (old) { old.remove(); }
      clearTimeout(toastTimer);
      document.body.appendChild(el('div', { class: 'toast', role: 'status', text: message }));
      toastTimer = setTimeout(function () {
        var current = $('.toast');
        if (current) { current.remove(); }
      }, 3500);
    } catch (err) { console.error('Joyce toast failed', err); }
  }

  /* ---------- Component loader (header / footer) ---------- */
  function loadComponents() {
    var slots = $$('[data-component]');
    return Promise.all(slots.map(function (slot) {
      var name = slot.getAttribute('data-component');
      return fetch('components/' + encodeURIComponent(name) + '.html')
        .then(function (res) {
          if (!res.ok) { throw new Error('HTTP ' + res.status); }
          return res.text();
        })
        .then(function (html) {
          var tpl = document.createElement('template');
          tpl.innerHTML = html;
          slot.replaceWith(tpl.content);   /* replaces wrapper so the sticky header works */
        })
        .catch(function (err) {
          console.error('Joyce: could not load component "' + name + '"', err);
          slot.replaceWith(el('p', { class: 'form-alert form-alert--error', role: 'alert',
            text: 'The ' + name + ' could not load. Open this site through a local server (for example VS Code Live Server) rather than double-clicking the file.' }));
        });
    }));
  }

  /* ---------- Config binding ---------- */
  function linkFor(type) {
    var h = CFG.hotel, b = CFG.brand;
    switch (type) {
      case 'phone':    return 'tel:' + String(h.phone).replace(/[^\d+]/g, '');
      case 'email':    return 'mailto:' + h.email;
      case 'whatsapp': return 'https://wa.me/' + digits(h.whatsapp) + '?text=' + encodeURIComponent(h.whatsappGreeting);
      case 'nexup':    return 'https://wa.me/' + digits(b.whatsapp) + '?text=' + encodeURIComponent(b.message);
      case 'table':    return 'https://wa.me/' + digits(h.whatsapp) + '?text=' + encodeURIComponent(CFG.dining.tableMessage);
      case 'events':   return 'https://wa.me/' + digits(h.whatsapp) + '?text=' + encodeURIComponent(CFG.dining.eventsMessage);
      case 'map':      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(h.mapQuery);
      default:         return null;
    }
  }

  function bindConfig(root) {
    $$('[data-cfg]', root).forEach(function (node) {
      var value = get(node.getAttribute('data-cfg'));
      if (value !== undefined && typeof value !== 'object') { node.textContent = value; }
      else { console.warn('Joyce: missing config value for', node.getAttribute('data-cfg')); }
    });
    $$('iframe[data-map]', root).forEach(function (frame) {
      frame.setAttribute('src', 'https://www.google.com/maps?q=' + encodeURIComponent(CFG.hotel.mapQuery) + '&output=embed');
    });
    $$('[data-link]', root).forEach(function (node) {
      var type = node.getAttribute('data-link');
      var href = linkFor(type);
      if (!href) { return; }
      node.setAttribute('href', href);
      if (/^(whatsapp|nexup|map|table|events)$/.test(type)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  /* ---------- Renderers ---------- */
  function linkItems(items, linkClass) {
    return items.map(function (item) {
      return el('li', {}, [el('a', { class: linkClass, href: item.href, text: item.label })]);
    });
  }

  function appendAll(container, nodes) { nodes.forEach(function (n) { container.appendChild(n); }); }

  function roomImage(room) {
    var img = el('img', { class: 'card-media', src: room.image, alt: room.imageAlt || room.name, width: '800', height: '600', loading: 'lazy' });
    img.addEventListener('error', function () {
      img.replaceWith(el('div', { class: 'card-media', role: 'img', 'aria-label': room.imageAlt || room.name }));
    }, { once: true });
    return img;
  }

  function roomCard(room) {
    return el('article', { class: 'card' }, [
      roomImage(room),
      el('div', { class: 'card-body' }, [
        el('h3', { text: room.name }),
        el('p', { text: room.tagline }),
        el('ul', { class: 'tag-list', role: 'list' }, [
          el('li', { class: 'tag', text: room.sizeSqm + ' m²' }),
          el('li', { class: 'tag', text: room.bed }),
          el('li', { class: 'tag', text: 'Sleeps ' + room.maxGuests })
        ])
      ]),
      el('div', { class: 'card-foot' }, [
        el('p', { class: 'price' }, [formatMoney(room.price), el('small', { text: ' per night' })]),
        el('a', { class: 'btn btn--ghost', href: 'room-details.html?room=' + encodeURIComponent(room.id), text: 'View room', 'aria-label': 'View ' + room.name })
      ])
    ]);
  }

  function renderRoomGrid(container, category, limit) {
    var rooms = CFG.rooms.filter(function (r) { return !category || category === 'All' || r.category === category; });
    if (limit) { rooms = rooms.slice(0, limit); }
    container.textContent = '';
    appendAll(container, rooms.map(roomCard));
  }

  function renderRoomTabs(grid) {
    var tabsBox = $('[data-room-tabs]');
    if (!tabsBox) { return; }
    var categories = ['All'];
    CFG.rooms.forEach(function (r) { if (categories.indexOf(r.category) === -1) { categories.push(r.category); } });
    tabsBox.setAttribute('role', 'tablist');
    tabsBox.textContent = '';
    var tabs = categories.map(function (cat, i) {
      return el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', text: cat });
    });
    function select(index) {
      tabs.forEach(function (tab, i) {
        tab.setAttribute('aria-selected', i === index ? 'true' : 'false');
        tab.setAttribute('tabindex', i === index ? '0' : '-1');
      });
      tabs[index].focus();
      renderRoomGrid(grid, categories[index]);
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i); });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length); }
      });
    });
    appendAll(tabsBox, tabs);
  }

  function renderAmenities(container) {
    var filter = container.getAttribute('data-filter');
    var items = CFG.amenities.filter(function (a) {
      return !filter || (filter === 'included' ? a.included : !a.included);
    });
    appendAll(container, items.map(function (a) {
      return el('article', { class: 'amenity' }, [
        el('span', { class: 'amenity-icon', 'aria-hidden': 'true', text: a.icon }),
        el('h3', { text: a.title }),
        el('p', { text: a.text }),
        el('ul', { class: 'tag-list', role: 'list' }, [
          a.included
            ? el('li', { class: 'tag', text: 'Included' })
            : el('li', { class: 'tag tag--paid', text: 'Extra charge: ' + a.priceNote })
        ])
      ]);
    }));
  }

  function renderReviews(container) {
    appendAll(container, CFG.reviews.map(function (r) {
      var rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
      return el('article', { class: 'review' }, [
        el('div', { class: 'stars', role: 'img', 'aria-label': rating + ' out of 5 stars', text: new Array(rating + 1).join('★') }),
        el('p', { text: r.text }),
        el('cite', { text: r.name + ', ' + r.source })
      ]);
    }));
  }

  function renderSocial(container) {
    appendAll(container, CFG.social.filter(function (s) { return s.url; }).map(function (s) {
      return el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': CFG.hotel.name + ' on ' + s.label, text: s.short });
    }));
  }

  function renderAll() {
    $$('[data-render]').forEach(function (node) {
      try {
        switch (node.getAttribute('data-render')) {
          case 'nav-links':      appendAll(node, linkItems(CFG.nav, 'nav-link')); break;
          case 'footer-links':   appendAll(node, linkItems(CFG.nav, '')); break;
          case 'policy-links':   appendAll(node, linkItems(CFG.policyLinks, '')); break;
          case 'social':         renderSocial(node); break;
          case 'featured-rooms': renderRoomGrid(node, 'All', parseInt(node.getAttribute('data-limit'), 10) || 3); break;
          case 'rooms':          renderRoomGrid(node, 'All'); renderRoomTabs(node); break;
          case 'room-table':     renderRoomTable(node); break;
          case 'room-detail':    renderRoomDetail(node); break;
          case 'dining-outlets': renderOutlets(node); break;
          case 'menu':           renderMenu(node); break;
          case 'event-table':    renderEventTable(node); break;
          case 'proximity':      renderProximity(node); break;
          case 'about-story':    renderAboutStory(node); break;
          case 'about-values':   renderAboutValues(node); break;
          case 'room-options':   renderRoomOptions(node); break;
          case 'extras':         renderExtras(node); break;
          case 'amenities':      renderAmenities(node); break;
          case 'reviews':        renderReviews(node); break;
          default: break;
        }
      } catch (err) { console.error('Joyce: render failed for', node.getAttribute('data-render'), err); }
    });
  }

  function renderRoomTable(tbody) {
    appendAll(tbody, CFG.rooms.map(function (r) {
      return el('tr', {}, [
        el('th', { scope: 'row', text: r.name }),
        el('td', { text: r.bed }),
        el('td', { text: r.sizeSqm + ' m² (' + Math.round(r.sizeSqm * 10.764) + ' sq ft)' }),
        el('td', { text: r.view }),
        el('td', { text: r.maxAdults + ' adults, up to ' + r.maxChildren + ' children (max ' + r.maxGuests + ')' }),
        el('td', {}, [el('span', { class: 'price', text: formatMoney(r.price) })])
      ]);
    }));
  }

  function sqFt(sqm) { return Math.round(sqm * 10.764); }

  function openLightbox(src, alt) {
    var dlg = $('#lightbox');
    if (!dlg) {
      var close = el('button', { class: 'dialog-close', type: 'button', 'aria-label': 'Close photo', text: '×' });
      dlg = el('dialog', { id: 'lightbox', 'aria-label': 'Photo viewer' }, [
        el('div', { class: 'dialog-head' }, [el('strong', { text: CFG.hotel.name }), close]),
        el('div', { class: 'dialog-body' }, [el('img', { alt: '' })])
      ]);
      close.addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) { dlg.close(); } });
      document.body.appendChild(dlg);
    }
    if (typeof dlg.showModal !== 'function') { window.open(src, '_blank', 'noopener'); return; }
    var photo = $('img', dlg);
    photo.src = src;
    photo.alt = alt || '';
    if (!dlg.open) { dlg.showModal(); }
  }

  function spec(label, value) {
    return el('li', {}, [el('span', { text: label }), el('strong', { text: value })]);
  }

  function renderRoomDetail(container) {
    var params = new URLSearchParams(window.location.search);
    var room = getRoom(params.get('room'));
    var titleEl = $('[data-room-title]');
    var tagEl = $('[data-room-tagline]');
    var others = $('[data-other-rooms]');

    if (others) {
      appendAll(others, CFG.rooms.filter(function (r) { return !room || r.id !== room.id; }).slice(0, 3).map(roomCard));
    }
    if (!room) {
      if (titleEl) { titleEl.textContent = 'Room not found'; }
      if (tagEl) { tagEl.textContent = 'That room is not available. Please choose one of our rooms.'; }
      container.appendChild(el('p', {}, [el('a', { class: 'btn btn--primary', href: 'rooms.html', text: 'View all rooms' })]));
      return;
    }

    document.title = room.name + ' | ' + CFG.hotel.name;
    var meta = $('meta[name="description"]');
    if (meta) { meta.setAttribute('content', room.description); }
    if (titleEl) { titleEl.textContent = room.name; }
    if (tagEl) { tagEl.textContent = room.tagline; }

    var left = el('div', { class: 'stack' }, [
      el('div', { class: 'card' }, [roomImage(room)]),
      el('h2', { text: 'About this room' }),
      el('p', { text: room.description }),
      el('h2', { text: 'In-room amenities' }),
      el('ul', { class: 'tag-list', role: 'list' }, room.amenities.map(function (a) { return el('li', { class: 'tag', text: a }); }))
    ]);

    var photos = room.gallery || [];
    if (photos.length) {
      var gallery = el('div', { class: 'gallery' });
      var block = el('div', { class: 'stack' }, [el('h2', { text: 'Photo gallery' }), gallery]);
      photos.forEach(function (src, i) {
        var img = el('img', { src: src, alt: room.name + ', photo ' + (i + 1), width: '400', height: '400', loading: 'lazy' });
        var btn = el('button', { type: 'button', 'aria-label': 'Enlarge photo ' + (i + 1) + ' of ' + room.name }, [img]);
        btn.addEventListener('click', function () { openLightbox(src, img.alt); });
        img.addEventListener('error', function () {
          btn.remove();
          if (!gallery.children.length) { block.remove(); }
        }, { once: true });
        gallery.appendChild(btn);
      });
      left.appendChild(block);
    }

    var waText = 'Hello ' + CFG.hotel.name + ', I would like to ask about the ' + room.name + '.';
    var aside = el('aside', { class: 'form-card stack', 'aria-label': 'Room summary and booking' }, [
      el('p', { class: 'price', style: 'font-size: 1.6rem;' }, [formatMoney(room.price), el('small', { text: ' per night' })]),
      el('ul', { class: 'spec-list', role: 'list' }, [
        spec('Bed', room.bed),
        spec('Size', room.sizeSqm + ' m² (' + sqFt(room.sizeSqm) + ' sq ft)'),
        spec('View', room.view),
        spec('Adults', 'Up to ' + room.maxAdults),
        spec('Children', 'Up to ' + room.maxChildren),
        spec('Maximum guests', String(room.maxGuests)),
        spec('Check-in', 'From ' + CFG.hotel.checkInTime),
        spec('Check-out', 'By ' + CFG.hotel.checkOutTime)
      ]),
      el('p', { class: 'field-hint', text: 'A ' + CFG.booking.taxPercent + '% tax is added at booking.' }),
      el('a', { class: 'btn btn--primary btn--block', href: 'booking.html?room=' + encodeURIComponent(room.id), text: 'Book this room' }),
      el('a', { class: 'btn btn--ghost btn--block', target: '_blank', rel: 'noopener noreferrer',
        href: 'https://wa.me/' + digits(CFG.hotel.whatsapp) + '?text=' + encodeURIComponent(waText), text: 'Ask on WhatsApp' })
    ]);

    container.appendChild(el('div', { class: 'grid split' }, [left, aside]));
  }

  function renderOutlets(container) {
    appendAll(container, CFG.dining.outlets.map(function (o) {
      return el('article', { class: 'amenity' }, [
        el('span', { class: 'amenity-icon', 'aria-hidden': 'true', text: o.icon }),
        el('h3', { text: o.name }),
        el('ul', { class: 'tag-list', role: 'list' }, [el('li', { class: 'tag', text: o.type })]),
        el('p', { text: o.description }),
        el('p', {}, [el('strong', { text: 'Hours: ' }), o.hours])
      ]);
    }));
  }

  function renderMenu(container) {
    appendAll(container, CFG.dining.menu.map(function (group) {
      return el('article', { class: 'card' }, [
        el('div', { class: 'card-body' }, [
          el('h3', { text: group.section }),
          el('ul', { class: 'spec-list', role: 'list' }, group.items.map(function (item) {
            return el('li', {}, [
              el('span', {}, [item.name, el('br'), el('small', { class: 'field-hint', text: item.description })]),
              el('strong', { text: formatMoney(item.price) })
            ]);
          }))
        ])
      ]);
    }));
  }

  function capacity(value) { return value === null || value === undefined ? 'N/A' : String(value); }

  function renderEventTable(tbody) {
    appendAll(tbody, CFG.dining.events.map(function (space) {
      return el('tr', {}, [
        el('th', { scope: 'row', text: space.name }),
        el('td', { text: space.sizeSqm + ' m²' }),
        el('td', { text: capacity(space.theatre) }),
        el('td', { text: capacity(space.classroom) }),
        el('td', { text: capacity(space.banquet) }),
        el('td', { text: capacity(space.cocktail) })
      ]);
    }));
  }

  function renderProximity(container) {
    appendAll(container, CFG.location.map(function (group) {
      return el('article', { class: 'amenity' }, [
        el('span', { class: 'amenity-icon', 'aria-hidden': 'true', text: group.icon }),
        el('h3', { text: group.group }),
        el('ul', { class: 'spec-list', role: 'list' }, group.items.map(function (item) {
          return el('li', {}, [el('span', { text: item.name }), el('strong', { text: item.distance })]);
        }))
      ]);
    }));
  }

  function renderAboutStory(container) {
    appendAll(container, CFG.about.story.map(function (text) { return el('p', { text: text }); }));
  }

  function renderAboutValues(container) {
    appendAll(container, CFG.about.values.map(function (v) {
      return el('article', { class: 'amenity' }, [
        el('span', { class: 'amenity-icon', 'aria-hidden': 'true', text: v.icon }),
        el('h3', { text: v.title }),
        el('p', { text: v.text })
      ]);
    }));
  }

  function renderRoomOptions(select) {
    select.appendChild(el('option', { value: '', text: 'Select a room' }));
    CFG.rooms.forEach(function (r) {
      select.appendChild(el('option', {
        value: r.id,
        text: r.name + ', ' + formatMoney(r.price) + ' per night, sleeps up to ' + r.maxGuests
      }));
    });
  }

  function renderExtras(container) {
    appendAll(container, CFG.extras.map(function (x) {
      var per = x.per === 'person-night' ? ' per person, per night' : ' per stay';
      var id = 'extra-' + x.id;
      return el('label', { class: 'check', for: id }, [
        el('input', { type: 'checkbox', name: 'extras', value: x.id, id: id }),
        el('span', { text: x.label + ' (' + formatMoney(x.price) + per + ')' })
      ]);
    }));
  }

  /* Hotel structured data for local SEO, generated from config.js so it never goes stale */
  function injectSchema() {
    if ($('#joyce-schema')) { return; }
    var h = CFG.hotel;
    var prices = CFG.rooms.map(function (r) { return r.price; });
    var data = {
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      name: h.name,
      description: h.tagline,
      telephone: h.phone,
      email: h.email,
      checkinTime: h.checkInTime,
      checkoutTime: h.checkOutTime,
      priceRange: formatMoney(Math.min.apply(null, prices)) + ' - ' + formatMoney(Math.max.apply(null, prices)),
      address: { '@type': 'PostalAddress', streetAddress: h.addressLine1, addressLocality: h.addressLine2 }
    };
    var script = el('script', { id: 'joyce-schema', type: 'application/ld+json' });
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /* ---------- Navigation ---------- */
  function markCurrentPage() {
    var file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    $$('.nav-link').forEach(function (link) {
      var target = (link.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (target === file) { link.setAttribute('aria-current', 'page'); }
      else { link.removeAttribute('aria-current'); }
    });
  }

  function initNav() {
    var toggle = $('.nav-toggle');
    var menu = $('#nav-menu');
    if (!toggle || !menu) { return; }

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () { setOpen(!menu.classList.contains('is-open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) { setOpen(false); } });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('is-open') && !e.target.closest('.site-header')) { setOpen(false); }
    });
    if (window.matchMedia) {
      var desktop = window.matchMedia('(min-width: 1024px)');
      var onChange = function (e) { if (e.matches) { setOpen(false); } };
      if (desktop.addEventListener) { desktop.addEventListener('change', onChange); }
      else if (desktop.addListener) { desktop.addListener(onChange); }
    }
  }

  /* ---------- Polish: header shadow on scroll + gentle reveal on scroll ---------- */
  function initHeaderShadow() {
    var header = $('.site-header');
    if (!header) { return; }
    function update() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* Reveal classes are added by JS only, so nothing is ever hidden if scripts fail. */
  function initReveal() {
    if (!('IntersectionObserver' in window)) { return; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    var targets = $$('.section-head, .card, .amenity, .review, .table-wrap');
    if (!targets.length) { return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var node = entry.target;
        observer.unobserve(node);
        node.classList.add('is-visible');
        setTimeout(function () {
          node.classList.remove('reveal', 'is-visible');
          node.style.removeProperty('--reveal-delay');
        }, 1300);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (node) {
      if (node.closest('dialog')) { return; }
      var parent = node.parentElement || document.body;
      var index = parent._joyceReveal || 0;
      parent._joyceReveal = index + 1;
      node.style.setProperty('--reveal-delay', (index % 4) * 90 + 'ms');
      node.classList.add('reveal');
      observer.observe(node);
    });
  }

  /* ---------- Persistent Book Now bar (every page) ---------- */
  function ensureBookBar() {
    if ($('.book-bar')) { return; }
    document.body.appendChild(el('aside', { class: 'book-bar', 'aria-label': 'Book your stay' }, [
      el('p', { text: 'Best rate when you book direct' }),
      el('a', { class: 'btn', href: 'booking.html', text: 'Book now' })
    ]));
  }

  /* ---------- Boot ---------- */
  var readyCallbacks = [];
  var isReady = false;
  function whenReady(cb) { if (isReady) { cb(); } else { readyCallbacks.push(cb); } }

  function init() {
    try {
      bindConfig(document);
      renderAll();
      markCurrentPage();
      initNav();
      ensureBookBar();
      injectSchema();
      initHeaderShadow();
      initReveal();
    } catch (err) {
      console.error('Joyce init failed', err);
    }
    isReady = true;
    readyCallbacks.splice(0).forEach(function (cb) { try { cb(); } catch (err) { console.error(err); } });
    document.dispatchEvent(new CustomEvent('joyce:ready'));
  }

  window.Joyce = Object.freeze({
    cfg: CFG, $: $, $$: $$, el: el, get: get, digits: digits,
    formatMoney: formatMoney, toISO: toISO, todayISO: todayISO, parseISO: parseISO,
    addDays: addDays, nightsBetween: nightsBetween, getRoom: getRoom, toast: toast,
    whenReady: whenReady
  });

  function start() { loadComponents().then(init); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
}());