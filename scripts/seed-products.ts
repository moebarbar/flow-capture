import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  console.log('Creating Stripe products and prices...');
  
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.list({ limit: 10 });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist, skipping seed');
    console.log('Existing products:', existingProducts.data.map(p => p.name).join(', '));
    return;
  }

  const freeProduct = await stripe.products.create({
    name: 'Free',
    description: 'Perfect for individuals getting started with workflow documentation',
    metadata: {
      tier: 'free',
      features: JSON.stringify([
        '5 guides per month',
        '1 workspace',
        'Basic step capture',
        'Community support'
      ])
    }
  });
  console.log('Created Free product:', freeProduct.id);

  await stripe.prices.create({
    product: freeProduct.id,
    unit_amount: 0,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'free' }
  });

  const proProduct = await stripe.products.create({
    name: 'Pro',
    description: 'For professionals who need advanced documentation features',
    metadata: {
      tier: 'pro',
      popular: 'true',
      features: JSON.stringify([
        'Unlimited guides',
        '5 workspaces',
        'AI-powered descriptions',
        'Custom branding',
        'Priority support',
        'Export to PDF'
      ])
    }
  });
  console.log('Created Pro product:', proProduct.id);

  const proMonthlyPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 1900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro', billing: 'monthly' }
  });
  console.log('Created Pro monthly price:', proMonthlyPrice.id);

  const proYearlyPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 15900,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { tier: 'pro', billing: 'yearly' }
  });
  console.log('Created Pro yearly price:', proYearlyPrice.id);

  const teamProduct = await stripe.products.create({
    name: 'Team',
    description: 'For teams that need collaboration and enterprise features',
    metadata: {
      tier: 'team',
      features: JSON.stringify([
        'Everything in Pro',
        'Unlimited workspaces',
        'Team collaboration',
        'SSO integration',
        'Admin dashboard',
        'API access',
        'Dedicated support'
      ])
    }
  });
  console.log('Created Team product:', teamProduct.id);

  const teamMonthlyPrice = await stripe.prices.create({
    product: teamProduct.id,
    unit_amount: 4900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'team', billing: 'monthly' }
  });
  console.log('Created Team monthly price:', teamMonthlyPrice.id);

  const teamYearlyPrice = await stripe.prices.create({
    product: teamProduct.id,
    unit_amount: 39900,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { tier: 'team', billing: 'yearly' }
  });
  console.log('Created Team yearly price:', teamYearlyPrice.id);

  console.log('\nAll products and prices created successfully!');
  console.log('Run syncBackfill() to sync them to the database.');
}

seedProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding products:', err);
    process.exit(1);
  });
