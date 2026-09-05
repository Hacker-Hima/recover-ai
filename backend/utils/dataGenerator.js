/**
 * RecoverAI Synthetic Data Generator
 * Generates realistic payment failure datasets for training and demo.
 * Uses a seeded RNG for full reproducibility.
 */

const seedrandom = require('seedrandom');

const SEED = process.env.DEMO_SEED || '42';
let rng = seedrandom(SEED);

function rand() { return rng(); }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function randChoice(arr) { return arr[Math.floor(rand() * arr.length)]; }
function randBool(prob = 0.5) { return rand() < prob; }
function randNormal(mean, std) {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Failure Taxonomy ──────────────────────────────────────────────────────────
const FAILURE_REASONS = {
  TRANSIENT: [
    { reason: 'bank_timeout', label: 'Bank Timeout' },
    { reason: 'network_error', label: 'Network Error' },
    { reason: 'gateway_timeout', label: 'Gateway Timeout' },
  ],
  SOFT_DECLINE: [
    { reason: 'insufficient_funds', label: 'Insufficient Funds' },
    { reason: 'temporary_limit', label: 'Temporary Limit Exceeded' },
    { reason: 'issuer_unavailable', label: 'Issuer Unavailable' },
  ],
  HARD_DECLINE: [
    { reason: 'expired_card', label: 'Card Expired' },
    { reason: 'invalid_card', label: 'Invalid Card' },
    { reason: 'blocked_card', label: 'Card Blocked' },
    { reason: 'authentication_failed', label: 'Authentication Failed' },
  ],
  CUSTOMER_ACTION_REQUIRED: [
    { reason: 'customer_cancelled', label: 'Customer Cancelled' },
    { reason: 'payment_abandoned', label: 'Payment Abandoned' },
  ],
  UNKNOWN: [
    { reason: 'unknown_failure', label: 'Unknown Failure' },
  ],
};

const FAILURE_CATEGORY_WEIGHTS = {
  TRANSIENT: 0.25,
  SOFT_DECLINE: 0.30,
  HARD_DECLINE: 0.25,
  CUSTOMER_ACTION_REQUIRED: 0.12,
  UNKNOWN: 0.08,
};

const PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'];
const METHOD_WEIGHTS = [0.30, 0.25, 0.25, 0.15, 0.05];

// Recovery probability by failure category (ground truth model)
const RECOVERY_BASE_PROB = {
  TRANSIENT: 0.82,
  SOFT_DECLINE: 0.55,
  HARD_DECLINE: 0.20,
  CUSTOMER_ACTION_REQUIRED: 0.30,
  UNKNOWN: 0.35,
};

// ─── Synthetic Names & Emails ───────────────────────────────────────────────────
const FIRST_NAMES = ['Arjun', 'Priya', 'Rohit', 'Sneha', 'Vikram', 'Ananya', 'Kiran', 'Deepa',
  'Rahul', 'Pooja', 'Sanjay', 'Meera', 'Amit', 'Kavya', 'Raj', 'Nisha',
  'Suresh', 'Divya', 'Manoj', 'Lakshmi', 'Aditya', 'Bhavna', 'Gaurav', 'Isha'];
const LAST_NAMES = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Mehta', 'Joshi', 'Reddy',
  'Nair', 'Pillai', 'Rao', 'Iyer', 'Kapoor', 'Malhotra', 'Verma', 'Dubey'];

function generateCustomerName() {
  return `${randChoice(FIRST_NAMES)} ${randChoice(LAST_NAMES)}`;
}
function generateEmail(name) {
  const clean = name.toLowerCase().replace(/\s+/g, '.');
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  return `${clean}${randInt(10, 999)}@${randChoice(domains)}`;
}

// ─── Customer Profile Generator ─────────────────────────────────────────────────
function generateCustomer(customerId, profile = 'mixed') {
  const name = generateCustomerName();
  const email = generateEmail(name);
  const tenureDays = randInt(30, 2000);

  let successRate, totalPayments, subscriptionStatus, riskTier;

  switch (profile) {
    case 'strong':
      successRate = rand() * 0.2 + 0.8;   // 0.80 – 1.00
      totalPayments = randInt(20, 200);
      subscriptionStatus = randChoice(['active', 'active', 'paused']);
      riskTier = 'low';
      break;
    case 'poor':
      successRate = rand() * 0.3;          // 0.00 – 0.30
      totalPayments = randInt(5, 50);
      subscriptionStatus = randChoice(['cancelled', 'paused', 'none']);
      riskTier = 'high';
      break;
    case 'subscription':
      successRate = rand() * 0.25 + 0.70;  // 0.70 – 0.95
      totalPayments = randInt(12, 120);
      subscriptionStatus = 'active';
      riskTier = 'low';
      break;
    default: // mixed
      successRate = rand() * 0.7 + 0.2;   // 0.20 – 0.90
      totalPayments = randInt(5, 100);
      subscriptionStatus = randChoice(['active', 'active', 'paused', 'cancelled', 'none']);
      riskTier = successRate > 0.7 ? 'low' : successRate > 0.4 ? 'medium' : 'high';
  }

  const successfulPayments = Math.round(totalPayments * successRate);
  const failedPayments = totalPayments - successfulPayments;
  const avgAmount = Math.round(randNormal(3000, 2000));

  return {
    customerId,
    name,
    email,
    phone: `+91${randInt(7000000000, 9999999999)}`,
    successfulPayments,
    failedPayments,
    averagePaymentAmount: Math.max(100, avgAmount),
    totalRevenue: successfulPayments * Math.max(100, avgAmount),
    customerTenureDays: tenureDays,
    subscriptionStatus,
    riskTier,
    contactCount: 0,
    preferredPaymentMethod: randChoice(PAYMENT_METHODS),
    paymentHistory: [],
  };
}

// ─── Weighted Random Choice ──────────────────────────────────────────────────────
function weightedChoice(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Payment Generator ───────────────────────────────────────────────────────────
function generatePayment(paymentId, customer, options = {}) {
  const {
    isSubscription = customer.subscriptionStatus === 'active',
    forcedCategory = null,
    forcedAttemptNumber = null,
    isHighValue = false,
  } = options;

  // Select failure category
  const categories = Object.keys(FAILURE_CATEGORY_WEIGHTS);
  const weights = categories.map(c => FAILURE_CATEGORY_WEIGHTS[c]);
  const failureCategory = forcedCategory || weightedChoice(categories, weights);

  const failureOptions = FAILURE_REASONS[failureCategory];
  const { reason: failureReason } = randChoice(failureOptions);

  // Select payment method
  const paymentMethod = weightedChoice(PAYMENT_METHODS, METHOD_WEIGHTS);

  // Amount: subscription is typically fixed; others vary
  let amount;
  if (isHighValue) {
    amount = Math.round(randNormal(25000, 8000));
  } else if (isSubscription) {
    amount = randChoice([199, 299, 499, 699, 999, 1499, 1999, 2999]);
  } else {
    amount = Math.round(Math.abs(randNormal(3000, 2500)));
  }
  amount = Math.max(99, amount);

  const attemptNumber = forcedAttemptNumber || randInt(1, 3);
  const previousSuccessRate = customer.successfulPayments /
    Math.max(1, customer.successfulPayments + customer.failedPayments);

  // Ground truth recovery: probabilistic based on category, customer history, attempt#
  const baseProb = RECOVERY_BASE_PROB[failureCategory];
  const adjustedProb = baseProb
    * (0.5 + 0.5 * previousSuccessRate)        // customer history factor
    * (attemptNumber === 1 ? 1.0 : attemptNumber === 2 ? 0.7 : 0.4)  // diminishing returns
    * (failureCategory === 'HARD_DECLINE' && paymentMethod === 'expired_card' ? 0.1 : 1.0);

  const groundTruthRecovered = rand() < adjustedProb;

  const createdAt = new Date(Date.now() - randInt(0, 30) * 24 * 60 * 60 * 1000);

  return {
    paymentId,
    customerId: customer.customerId,
    amount,
    currency: 'INR',
    paymentMethod,
    status: 'failed',
    failureReason,
    failureCategory,
    attemptNumber,
    previousSuccessRate: Math.round(previousSuccessRate * 100) / 100,
    previousFailures: customer.failedPayments,
    customerTenureDays: customer.customerTenureDays,
    subscription: isSubscription,
    groundTruthRecovered,
    revenueAtRisk: amount,
    recoveredAmount: 0,
    agentSource: 'unprocessed',
    isDemo: false,
    createdAt,
    updatedAt: createdAt,
  };
}

// ─── Main Generator ──────────────────────────────────────────────────────────────
function generateDataset(count = 5000) {
  // Reset RNG for reproducibility
  rng = seedrandom(SEED);

  const customers = [];
  const payments = [];

  // Profile distribution for customers
  const profiles = ['strong', 'poor', 'subscription', 'mixed'];
  const profileWeights = [0.25, 0.20, 0.20, 0.35];

  const numCustomers = Math.floor(count * 0.15); // ~15% unique customers

  // Generate customers
  for (let i = 0; i < numCustomers; i++) {
    const customerId = `CUST-${String(i + 1).padStart(5, '0')}`;
    const profile = weightedChoice(profiles, profileWeights);
    customers.push(generateCustomer(customerId, profile));
  }

  // Generate payments: mix of single and repeat failures per customer
  let paymentIndex = 0;

  // Some customers have multiple failed payments
  for (let i = 0; i < count; i++) {
    const customer = customers[randInt(0, numCustomers - 1)];
    const paymentId = `PAY-${String(paymentIndex + 1).padStart(7, '0')}`;

    const isHighValue = rand() < 0.10; // 10% high-value
    const isSubscription = customer.subscriptionStatus === 'active' && rand() < 0.6;

    const payment = generatePayment(paymentId, customer, { isHighValue, isSubscription });
    payments.push(payment);
    paymentIndex++;
  }

  // Add repeated failures (customers with 2-3 attempts)
  const repeatCount = Math.floor(count * 0.15);
  for (let i = 0; i < repeatCount; i++) {
    const basePayment = payments[randInt(0, payments.length - 1)];
    const customer = customers.find(c => c.customerId === basePayment.customerId);
    if (!customer) continue;

    const paymentId = `PAY-${String(paymentIndex + 1).padStart(7, '0')}`;
    const payment = generatePayment(paymentId, customer, {
      forcedAttemptNumber: randInt(2, 3),
      forcedCategory: basePayment.failureCategory,
    });
    payments.push(payment);
    paymentIndex++;
  }

  return { customers, payments };
}

// ─── 20 Curated Demo Cases ───────────────────────────────────────────────────────
function generateDemoCases() {
  // Use fixed seed for demo
  rng = seedrandom('DEMO_42');

  const demoCustomers = [
    generateCustomer('DEMO-CUST-001', 'strong'),   // High success rate
    generateCustomer('DEMO-CUST-002', 'mixed'),    // Mixed history
    generateCustomer('DEMO-CUST-003', 'poor'),     // Poor history
    generateCustomer('DEMO-CUST-004', 'subscription'), // Subscriber
    generateCustomer('DEMO-CUST-005', 'mixed'),
    generateCustomer('DEMO-CUST-006', 'strong'),
    generateCustomer('DEMO-CUST-007', 'poor'),
    generateCustomer('DEMO-CUST-008', 'mixed'),
    generateCustomer('DEMO-CUST-009', 'subscription'),
    generateCustomer('DEMO-CUST-010', 'strong'),
  ];

  // Override customer fields for clarity
  demoCustomers[0] = { ...demoCustomers[0], successfulPayments: 145, failedPayments: 5, customerTenureDays: 1200, subscriptionStatus: 'active' };
  demoCustomers[2] = { ...demoCustomers[2], successfulPayments: 8, failedPayments: 22, customerTenureDays: 90, subscriptionStatus: 'cancelled' };
  demoCustomers[3] = { ...demoCustomers[3], successfulPayments: 48, failedPayments: 4, customerTenureDays: 730, subscriptionStatus: 'active' };

  const demos = [
    // 1. High-value transient → should recover
    {
      paymentId: 'DEMO-PAY-001', customerId: 'DEMO-CUST-001',
      amount: 45000, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'bank_timeout', failureCategory: 'TRANSIENT',
      attemptNumber: 1, previousSuccessRate: 0.97, previousFailures: 5,
      customerTenureDays: 1200, subscription: true,
      groundTruthRecovered: true, revenueAtRisk: 45000, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'High-value transient failure → recovered',
    },
    // 2. Insufficient funds → delayed retry
    {
      paymentId: 'DEMO-PAY-002', customerId: 'DEMO-CUST-002',
      amount: 2999, currency: 'INR', paymentMethod: 'debit_card',
      status: 'failed', failureReason: 'insufficient_funds', failureCategory: 'SOFT_DECLINE',
      attemptNumber: 1, previousSuccessRate: 0.72, previousFailures: 8,
      customerTenureDays: 420, subscription: false,
      groundTruthRecovered: true, revenueAtRisk: 2999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Insufficient funds → delayed retry',
    },
    // 3. Expired card → payment link
    {
      paymentId: 'DEMO-PAY-003', customerId: 'DEMO-CUST-004',
      amount: 499, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'expired_card', failureCategory: 'HARD_DECLINE',
      attemptNumber: 1, previousSuccessRate: 0.92, previousFailures: 4,
      customerTenureDays: 730, subscription: true,
      groundTruthRecovered: true, revenueAtRisk: 499, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Expired card → send payment link',
    },
    // 4. Repeated failures → stop
    {
      paymentId: 'DEMO-PAY-004', customerId: 'DEMO-CUST-003',
      amount: 1499, currency: 'INR', paymentMethod: 'net_banking',
      status: 'failed', failureReason: 'insufficient_funds', failureCategory: 'SOFT_DECLINE',
      attemptNumber: 3, previousSuccessRate: 0.27, previousFailures: 22,
      customerTenureDays: 90, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 1499, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Repeated failures (attempt 3) → stop',
    },
    // 5. Ambiguous failure → human review
    {
      paymentId: 'DEMO-PAY-005', customerId: 'DEMO-CUST-005',
      amount: 8500, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'unknown_failure', failureCategory: 'UNKNOWN',
      attemptNumber: 1, previousSuccessRate: 0.55, previousFailures: 12,
      customerTenureDays: 300, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 8500, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Ambiguous unknown failure → human review',
    },
    // 6. Low recovery probability → stop
    {
      paymentId: 'DEMO-PAY-006', customerId: 'DEMO-CUST-007',
      amount: 750, currency: 'INR', paymentMethod: 'wallet',
      status: 'failed', failureReason: 'blocked_card', failureCategory: 'HARD_DECLINE',
      attemptNumber: 2, previousSuccessRate: 0.15, previousFailures: 18,
      customerTenureDays: 45, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 750, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Low recovery probability → stop',
    },
    // 7. High-value ambiguous → human review
    {
      paymentId: 'DEMO-PAY-007', customerId: 'DEMO-CUST-008',
      amount: 85000, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'authentication_failed', failureCategory: 'HARD_DECLINE',
      attemptNumber: 1, previousSuccessRate: 0.62, previousFailures: 6,
      customerTenureDays: 580, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 85000, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'High-value ambiguous case → human review',
    },
    // 8. Strong customer history → recovery
    {
      paymentId: 'DEMO-PAY-008', customerId: 'DEMO-CUST-001',
      amount: 5999, currency: 'INR', paymentMethod: 'upi',
      status: 'failed', failureReason: 'gateway_timeout', failureCategory: 'TRANSIENT',
      attemptNumber: 1, previousSuccessRate: 0.97, previousFailures: 5,
      customerTenureDays: 1200, subscription: false,
      groundTruthRecovered: true, revenueAtRisk: 5999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Strong customer + transient → recovery',
    },
    // 9. Poor customer history → stop
    {
      paymentId: 'DEMO-PAY-009', customerId: 'DEMO-CUST-003',
      amount: 999, currency: 'INR', paymentMethod: 'debit_card',
      status: 'failed', failureReason: 'issuer_unavailable', failureCategory: 'SOFT_DECLINE',
      attemptNumber: 2, previousSuccessRate: 0.27, previousFailures: 22,
      customerTenureDays: 90, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Poor customer history → stop',
    },
    // 10. Successful retry (transient, first attempt)
    {
      paymentId: 'DEMO-PAY-010', customerId: 'DEMO-CUST-009',
      amount: 1999, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'network_error', failureCategory: 'TRANSIENT',
      attemptNumber: 1, previousSuccessRate: 0.88, previousFailures: 3,
      customerTenureDays: 650, subscription: true,
      groundTruthRecovered: true, revenueAtRisk: 1999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Transient network error → successful retry',
    },
    // 11. Customer cancelled → reminder
    {
      paymentId: 'DEMO-PAY-011', customerId: 'DEMO-CUST-006',
      amount: 3499, currency: 'INR', paymentMethod: 'upi',
      status: 'failed', failureReason: 'customer_cancelled', failureCategory: 'CUSTOMER_ACTION_REQUIRED',
      attemptNumber: 1, previousSuccessRate: 0.85, previousFailures: 6,
      customerTenureDays: 900, subscription: false,
      groundTruthRecovered: true, revenueAtRisk: 3499, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Customer cancelled → send reminder',
    },
    // 12. Invalid card → suggest alternative method
    {
      paymentId: 'DEMO-PAY-012', customerId: 'DEMO-CUST-010',
      amount: 12500, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'invalid_card', failureCategory: 'HARD_DECLINE',
      attemptNumber: 1, previousSuccessRate: 0.90, previousFailures: 4,
      customerTenureDays: 1100, subscription: false,
      groundTruthRecovered: true, revenueAtRisk: 12500, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Invalid card + good history → suggest alternative',
    },
    // 13. Subscription + bank timeout → retry later
    {
      paymentId: 'DEMO-PAY-013', customerId: 'DEMO-CUST-004',
      amount: 999, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'bank_timeout', failureCategory: 'TRANSIENT',
      attemptNumber: 1, previousSuccessRate: 0.92, previousFailures: 4,
      customerTenureDays: 730, subscription: true,
      groundTruthRecovered: true, revenueAtRisk: 999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Subscription bank timeout → retry later',
    },
    // 14. Temporary limit → retry later
    {
      paymentId: 'DEMO-PAY-014', customerId: 'DEMO-CUST-002',
      amount: 7999, currency: 'INR', paymentMethod: 'debit_card',
      status: 'failed', failureReason: 'temporary_limit', failureCategory: 'SOFT_DECLINE',
      attemptNumber: 1, previousSuccessRate: 0.72, previousFailures: 8,
      customerTenureDays: 420, subscription: false,
      groundTruthRecovered: true, revenueAtRisk: 7999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Temporary limit → retry later',
    },
    // 15. Payment abandoned (low value, poor history) → stop
    {
      paymentId: 'DEMO-PAY-015', customerId: 'DEMO-CUST-007',
      amount: 299, currency: 'INR', paymentMethod: 'wallet',
      status: 'failed', failureReason: 'payment_abandoned', failureCategory: 'CUSTOMER_ACTION_REQUIRED',
      attemptNumber: 2, previousSuccessRate: 0.15, previousFailures: 18,
      customerTenureDays: 45, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 299, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Abandoned payment + poor history → stop',
    },
    // 16. Max contacts already reached → escalate/stop
    {
      paymentId: 'DEMO-PAY-016', customerId: 'DEMO-CUST-005',
      amount: 4999, currency: 'INR', paymentMethod: 'net_banking',
      status: 'failed', failureReason: 'insufficient_funds', failureCategory: 'SOFT_DECLINE',
      attemptNumber: 2, previousSuccessRate: 0.55, previousFailures: 12,
      customerTenureDays: 300, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 4999, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Multiple contacts already made → escalate',
    },
    // 17. Strong subscriber, issuer unavailable → retry now
    {
      paymentId: 'DEMO-PAY-017', customerId: 'DEMO-CUST-009',
      amount: 299, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'issuer_unavailable', failureCategory: 'TRANSIENT',
      attemptNumber: 1, previousSuccessRate: 0.88, previousFailures: 3,
      customerTenureDays: 650, subscription: true,
      groundTruthRecovered: true, revenueAtRisk: 299, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Subscriber issuer unavailable → retry now',
    },
    // 18. Low confidence diagnosis → human review
    {
      paymentId: 'DEMO-PAY-018', customerId: 'DEMO-CUST-008',
      amount: 15000, currency: 'INR', paymentMethod: 'credit_card',
      status: 'failed', failureReason: 'unknown_failure', failureCategory: 'UNKNOWN',
      attemptNumber: 1, previousSuccessRate: 0.62, previousFailures: 6,
      customerTenureDays: 580, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 15000, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Unknown failure + high value → human review',
    },
    // 19. Good customer, transient + attempt 2 → retry later
    {
      paymentId: 'DEMO-PAY-019', customerId: 'DEMO-CUST-006',
      amount: 2499, currency: 'INR', paymentMethod: 'upi',
      status: 'failed', failureReason: 'network_error', failureCategory: 'TRANSIENT',
      attemptNumber: 2, previousSuccessRate: 0.85, previousFailures: 6,
      customerTenureDays: 900, subscription: false,
      groundTruthRecovered: true, revenueAtRisk: 2499, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Good customer transient attempt 2 → retry later',
    },
    // 20. Hard decline max attempts → stop (final case)
    {
      paymentId: 'DEMO-PAY-020', customerId: 'DEMO-CUST-003',
      amount: 599, currency: 'INR', paymentMethod: 'debit_card',
      status: 'failed', failureReason: 'blocked_card', failureCategory: 'HARD_DECLINE',
      attemptNumber: 3, previousSuccessRate: 0.27, previousFailures: 22,
      customerTenureDays: 90, subscription: false,
      groundTruthRecovered: false, revenueAtRisk: 599, recoveredAmount: 0,
      agentSource: 'unprocessed', isDemo: true,
      demoScenario: 'Hard decline max attempts poor history → stop',
    },
  ].map(p => ({ ...p, createdAt: new Date(), updatedAt: new Date() }));

  // Attach customer data
  const demoCustomerMap = {};
  demoCustomers.forEach(c => { demoCustomerMap[c.customerId] = c; });

  return { customers: demoCustomers, payments: demos };
}

module.exports = { generateDataset, generateDemoCases };

// CLI usage: node dataGenerator.js
if (require.main === module) {
  const { customers, payments } = generateDataset(5000);
  console.log(`Generated ${customers.length} customers and ${payments.length} payments`);
  console.log('Sample payment:', JSON.stringify(payments[0], null, 2));
  const recovered = payments.filter(p => p.groundTruthRecovered).length;
  console.log(`Ground truth recovery rate: ${((recovered / payments.length) * 100).toFixed(1)}%`);

  // Category breakdown
  const byCategory = {};
  payments.forEach(p => {
    byCategory[p.failureCategory] = (byCategory[p.failureCategory] || 0) + 1;
  });
  console.log('By category:', byCategory);
}
