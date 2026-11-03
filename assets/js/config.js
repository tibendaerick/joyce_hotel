/* ==========================================================================
   Joyce Hotel: config.js
   THE ONLY FILE YOU EDIT to change contacts, rates, rooms, amenities,
   policy numbers, reviews and social links. Every page reads from here.
   Load order on every page (all with defer): config.js, main.js, booking.js
   Values marked REPLACE are sample data. Swap them before going live.
   ========================================================================== */
(function () {
  'use strict';

  function deepFreeze(obj) {
    Object.keys(obj).forEach(function (key) {
      if (obj[key] && typeof obj[key] === 'object') { deepFreeze(obj[key]); }
    });
    return Object.freeze(obj);
  }

  var config = {

    /* ---- Hotel identity and contacts (REPLACE) ---- */
    hotel: {
      name: 'Joyce Hotel',
      legalName: 'Joyce Hotel Limited',   /* REPLACE with the registered company name */
      tagline: 'Comfort and calm in the heart of Mubende',
      copyrightYears: '2020 - 2026',
      addressLine1: '12 Joyce Avenue, Kisekende',
      addressLine2: 'Mubende, Uganda',
      mapQuery: 'Kisekende, Mubende, Uganda',
      phone: '+256 761 468 955',
      email: 'joycehotelug@gmail.com',
      whatsapp: '256761468955',            /* digits only, with country code, no + */
      whatsappGreeting: 'Hello Joyce Hotel, I would like to make an enquiry.',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      receptionHours: 'Reception open 24 hours'
    },

    /* ---- Agency credit shown in the footer (REPLACE number) ---- */
    brand: {
      name: 'NexUp Technologies',
      copyrightYear: '2026',
      whatsapp: '256766845860',            /* digits only, with country code */
      message: 'Hello NexUp Technologies, Can we do business?'
    },

    /* ---- Social links: leave url empty ('') to hide an icon (REPLACE) ---- */
    social: [
      { label: 'Facebook',  short: 'Fb', url: 'https://www.facebook.com/' },
      { label: 'Instagram', short: 'Ig', url: 'https://www.instagram.com/' },
      { label: 'X',         short: 'X',  url: 'https://x.com/' }
    ],

    /* ---- Navigation (header, mobile menu and footer quick links) ---- */
    nav: [
      { label: 'Home',      href: 'index.html' },
      { label: 'Rooms',     href: 'rooms.html' },
      { label: 'Amenities', href: 'amenities.html' },
      { label: 'Dining',    href: 'dining.html' },
      { label: 'About',     href: 'about.html' },
      { label: 'Contact',   href: 'contact.html' }
    ],

    policyLinks: [
      { label: 'Refund and cancellation policy', href: 'policies.html#refunds' },
      { label: 'Terms of service',               href: 'policies.html#terms' },
      { label: 'Privacy notice',                 href: 'policies.html#privacy' }
    ],

    /* ---- Direct-booking offer banner ---- */
    offer: {
      text: 'Book direct: best rate guaranteed and a free welcome drink.',
      cta: 'Book direct'
    },

    /* ---- Booking rules used by the strict availability form. ALL MONEY IS IN UGX. Tax 18 is the standard Uganda VAT rate: confirm with your accountant. ---- */
    booking: {
      currency: 'UGX',
      locale: 'en-UG',
      taxPercent: 18,
      depositPercent: 30,
      minNights: 1,
      maxNights: 30,
      maxAdvanceDays: 365,
      maxRooms: 3,
      maxChildAge: 17,
      freeCancelHours: 48,
      noRefundHours: 24,
      lateCancelRefundPercent: 50
    },

    /* ---- Policy numbers used by policies.html (have a Ugandan advocate review before launch) ---- */
    policy: {
      version: '1.0',
      effectiveDate: '1 December 2020',
      refundDays: 14,
      minAge: 18,
      incidentalDeposit: 'UGX 100,000',
      smokingFee: 'UGX 500,000',
      lateCheckoutUntil: '18:00',
      lateCheckoutPercent: 50,
      quietHours: '22:00 to 06:00',
      retention: 'five (5) years',
      creditMonths: 12
    },

    /* ---- Optional extras (price is per stay, or per person per night) ---- */
    extras: [
      { id: 'breakfast', label: 'Breakfast buffet', price: 35000, per: 'person-night' },
      { id: 'shuttle',   label: 'Airport shuttle (one way)', price: 120000, per: 'stay' }
    ],

    /* ---- Rooms (REPLACE rates in UGX, sizes and images). Main image in assets/images/rooms/, gallery photos in assets/images/gallery/ ---- */
    rooms: [
      {
        id: 'standard', category: 'Standard', name: 'Standard Room',
        tagline: 'Smart, quiet and well equipped for short stays.',
        description: 'A calm room with a comfortable queen bed, a work desk and blackout curtains, ideal for solo travellers and couples.',
        price: 115000, sizeSqm: 22, bed: '1 queen bed', view: 'City view',
        maxAdults: 2, maxChildren: 1, maxGuests: 3,
        amenities: ['High-speed Wi-Fi', 'Work desk', 'Air conditioning', 'Flat-screen TV', 'Private bathroom with rain shower'],
        image: 'assets/images/rooms/standard.jpg', imageAlt: 'Standard room with a queen bed and work desk',
        gallery: ['assets/images/gallery/standard-1.jpg', 'assets/images/gallery/standard-2.jpg', 'assets/images/gallery/standard-3.jpg']
      },
      {
        id: 'deluxe', category: 'Deluxe', name: 'Deluxe Room',
        tagline: 'More space, a better view and an espresso machine.',
        description: 'A spacious room with a king bed, a seating corner and a garden view, with an espresso machine for slow mornings.',
        price: 165000, sizeSqm: 30, bed: '1 king bed', view: 'Garden view',
        maxAdults: 2, maxChildren: 2, maxGuests: 4,
        amenities: ['High-speed Wi-Fi', 'Espresso machine', 'Seating corner', 'Work desk', 'Mini fridge', 'Bathtub and rain shower'],
        image: 'assets/images/rooms/deluxe.jpg', imageAlt: 'Deluxe room with a king bed and seating corner',
        gallery: ['assets/images/gallery/deluxe-1.jpg', 'assets/images/gallery/deluxe-2.jpg', 'assets/images/gallery/deluxe-3.jpg']
      },
      {
        id: 'executive', category: 'Executive', name: 'Executive Room',
        tagline: 'Built for business travel, with a proper workspace.',
        description: 'A top-floor room with a king bed, a large desk, ergonomic chair and a lounge area, with early breakfast service on request.',
        price: 215000, sizeSqm: 36, bed: '1 king bed', view: 'Skyline view',
        maxAdults: 2, maxChildren: 2, maxGuests: 4,
        amenities: ['High-speed Wi-Fi', 'Large work desk', 'Espresso machine', 'Lounge area', 'Iron and ironing board', 'Mini bar'],
        image: 'assets/images/rooms/executive.jpg', imageAlt: 'Executive room with a large desk and lounge area',
        gallery: ['assets/images/gallery/executive-1.jpg', 'assets/images/gallery/executive-2.jpg', 'assets/images/gallery/executive-3.jpg']
      },
      {
        id: 'suite', category: 'Suite', name: 'Joyce Suite',
        tagline: 'Separate living room and room for the whole family.',
        description: 'Our largest accommodation, with a king bedroom, a separate living room with a sofa bed and a private balcony.',
        price: 515000, sizeSqm: 55, bed: '1 king bed + sofa bed', view: 'Skyline view with balcony',
        maxAdults: 3, maxChildren: 2, maxGuests: 5,
        amenities: ['High-speed Wi-Fi', 'Separate living room', 'Private balcony', 'Espresso machine', 'Dining table', 'Bathtub and rain shower'],
        image: 'assets/images/rooms/suite.jpg', imageAlt: 'Joyce Suite living room with a sofa bed and balcony',
        gallery: ['assets/images/gallery/suite-1.jpg', 'assets/images/gallery/suite-2.jpg', 'assets/images/gallery/suite-3.jpg']
      }
    ],

    /* ---- Amenities: included:true means free; included:false shows an extra-charge tag ---- */
    amenities: [
      { icon: '📶', title: 'High-speed Wi-Fi',   text: 'Fast, reliable Wi-Fi throughout the hotel.', included: true },
      { icon: '🚗', title: 'Secure parking',     text: 'On-site parking for guests, subject to availability.', included: true },
      { icon: '🍳', title: 'Breakfast buffet',   text: 'Served daily in the breakfast lounge.', included: false, priceNote: 'UGX 35,000 per person per night' },
      { icon: '🚐', title: 'Airport shuttle',    text: 'Pre-book a pick-up or drop-off with reception.', included: false, priceNote: 'UGX 120,000 per trip' },
      { icon: '🌿', title: 'Spa and wellness',   text: 'Massages and treatments by appointment.', included: false, priceNote: 'Price on request' },
      { icon: '🏋️', title: 'Fitness center',     text: 'Open daily with cardio and free weights.', included: true },
      { icon: '🛎️', title: '24/7 room service',  text: 'Meals and essentials delivered to your room.', included: false, priceNote: 'Menu prices apply' },
      { icon: '💼', title: 'Business center',    text: 'Printing, scanning and a quiet workspace.', included: true }
    ],

    /* ---- Dining and events (REPLACE with real outlets, hours, menus, capacities) ---- */
    dining: {
      tableMessage: 'Hello Joyce Hotel, I would like to reserve a table. Date: , time: , number of guests: .',
      eventsMessage: 'Hello Joyce Hotel, I would like to enquire about hosting an event. Type of event: , date: , number of guests: .',
      outlets: [
        { icon: '🍽️', type: 'Restaurant', name: 'The Garden Restaurant', hours: 'Lunch 12:00 to 15:00, dinner 18:00 to 22:30', description: 'Seasonal cooking built around local produce, with vegetarian and gluten-free options on every menu.' },
        { icon: '🍸', type: 'Bar', name: 'Joyce Lounge Bar', hours: 'Daily 16:00 to 23:30', description: 'Classic cocktails, local wines and light bites in a relaxed lounge.' },
        { icon: '☕', type: 'Breakfast', name: 'Breakfast Lounge', hours: 'Daily 06:30 to 10:30', description: 'A hot and cold breakfast buffet, with early packed breakfasts on request.' }
      ],
      menu: [
        { section: 'Breakfast', items: [
          { name: 'Breakfast buffet', description: 'Hot and cold selection, fresh fruit and pastries', price: 35000 },
          { name: 'Eggs your way', description: 'With toast and roasted tomato', price: 18000 },
          { name: 'Fresh juice', description: 'Orange, pineapple or mixed fruit', price: 10000 }
        ] },
        { section: 'Lunch and dinner', items: [
          { name: 'Grilled chicken', description: 'Herb marinade with seasonal vegetables', price: 45000 },
          { name: 'Catch of the day', description: 'Lemon butter, potatoes and greens', price: 55000 },
          { name: 'Garden vegetable curry', description: 'Coconut sauce with steamed rice', price: 38000 }
        ] },
        { section: 'Bar and snacks', items: [
          { name: 'Signature cocktail', description: 'Ask your server for the house selection', price: 28000 },
          { name: 'Local wine by the glass', description: 'Red, white or rose', price: 25000 },
          { name: 'Club sandwich', description: 'Served with fries', price: 30000 }
        ] }
      ],
      /* Capacities by layout. Use null where a layout is not available. */
      events: [
        { name: 'Joyce Boardroom', sizeSqm: 28,  theatre: 20,  classroom: 12, banquet: 10, cocktail: 20 },
        { name: 'Garden Hall',     sizeSqm: 90,  theatre: 80,  classroom: 48, banquet: 60,   cocktail: 100 },
        { name: 'Grand Ballroom',  sizeSqm: 220, theatre: 220, classroom: 120, banquet: 160, cocktail: 250 }
      ]
    },

    /* ---- About page (REPLACE with the hotel real story and values) ---- */
    about: {
      story: [
        'Joyce Hotel was created around a simple idea: a city hotel should feel like a calm, well-run home for the people who stay in it.',
        'We keep things straightforward. Comfortable rooms, honest prices and a team that remembers your name. Business travellers, families and weekend visitors all find the same warm welcome.',
        'Our central location puts offices, restaurants and transport within easy reach, so you spend less time getting around and more time on what brought you to the city.'
      ],
      values: [
        { icon: '🤝', title: 'Warm, personal service', text: 'Our team is on hand around the clock and treats every guest as a welcome visitor, not a booking number.' },
        { icon: '🧼', title: 'Spotless and well kept', text: 'Rooms and shared spaces are cleaned and checked daily to a consistent standard.' },
        { icon: '💬', title: 'Honest and transparent', text: 'Clear prices, clear policies and no hidden fees. What you see when you book is what you pay.' }
      ]
    },

    /* ---- Nearby places (REPLACE with real names and distances) ---- */
    location: [
      { icon: '🚉', group: 'Transport', items: [
        { name: 'Main Taxi Park', distance: '15 min walk' },
        { name: 'Summit Bus terminal', distance: '3 min walk' },
        { name: 'Referral Hospital', distance: '10 min by car' }
      ] },
      { icon: '🍴', group: 'Dining and shopping', items: [
        { name: 'Restaurant row', distance: '2 min walk' },
        { name: 'Central Market', distance: '15 min walk' },
        { name: 'Shopping Mall', distance: '5 min by car' }
      ] },
      { icon: '🏛️', group: 'Attractions', items: [
        { name: 'Nakayima Tree', distance: '10 min by car' },
        { name: 'NTC Masaza Grounds', distance: '12 min walk' },
        { name: 'DownTown Temple', distance: '5 min by car' }
      ] }
    ],

    /* ---- Reviews (REPLACE with real, verified guest reviews) ---- */
    reviews: [
      { name: 'Edith N..',  source: 'Verified guest, Business trip', rating: 5, text: 'Spotless room, fast Wi-Fi and a desk I could actually work at. Check-in took two minutes.' },
      { name: 'David and Kylie', source: 'Verified guest, Weekend stay', rating: 5, text: 'Quiet, central and the breakfast was excellent. The staff remembered our names by day two.' },
      { name: 'Nasser K.',  source: 'Verified guest, Family stay', rating: 4, text: 'The suite gave our family plenty of space and the shuttle was on time. We will be back.' }
    ]
  };

  window.JOYCE_CONFIG = deepFreeze(config);
}());