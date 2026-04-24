const Stripe = require('stripe');
const s = new Stripe('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', {apiVersion:'2024-11-20.acacia'});

s.checkout.sessions.list({limit:1})
  .then(r => {
    console.log('OK:', JSON.stringify(r.data[0]?.id || 'No sessions'));
    process.exit(0);
  })
  .catch(e => {
    console.log('Error:', e.message);
    console.log('Code:', e.code);
    process.exit(1);
  });
