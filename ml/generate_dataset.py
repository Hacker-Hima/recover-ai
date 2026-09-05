"""
RecoverAI ML — Dataset Generator
Exports synthetic payment data as CSV for model training.
"""
import json
import csv
import sys
import os

# We call Node to generate the dataset, then parse and write CSV
# Alternatively, replicate the logic in Python for portability

import random
import math

random.seed(42)

FAILURE_CATEGORY_WEIGHTS = {
    'TRANSIENT': 0.25,
    'SOFT_DECLINE': 0.30,
    'HARD_DECLINE': 0.25,
    'CUSTOMER_ACTION_REQUIRED': 0.12,
    'UNKNOWN': 0.08,
}

PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet']
METHOD_WEIGHTS = [0.30, 0.25, 0.25, 0.15, 0.05]

RECOVERY_BASE_PROB = {
    'TRANSIENT': 0.82,
    'SOFT_DECLINE': 0.55,
    'HARD_DECLINE': 0.20,
    'CUSTOMER_ACTION_REQUIRED': 0.30,
    'UNKNOWN': 0.35,
}

def weighted_choice(items, weights):
    total = sum(weights)
    r = random.random() * total
    for item, w in zip(items, weights):
        r -= w
        if r <= 0:
            return item
    return items[-1]

def generate_row(i):
    categories = list(FAILURE_CATEGORY_WEIGHTS.keys())
    weights = list(FAILURE_CATEGORY_WEIGHTS.values())
    failure_category = weighted_choice(categories, weights)
    
    payment_method = weighted_choice(PAYMENT_METHODS, METHOD_WEIGHTS)
    
    # Amount (log-normal-ish)
    amount = max(99, int(abs(random.gauss(3000, 2500))))
    
    attempt_number = random.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
    previous_success_rate = random.uniform(0.0, 1.0)
    previous_failures = random.randint(0, 25)
    customer_tenure_days = random.randint(30, 2000)
    subscription = random.random() < 0.35
    
    # Ground truth
    base_prob = RECOVERY_BASE_PROB[failure_category]
    adj_prob = base_prob
    adj_prob *= (0.5 + 0.5 * previous_success_rate)
    retry_factor = {1: 1.0, 2: 0.7, 3: 0.4}.get(attempt_number, 0.4)
    adj_prob *= retry_factor
    if subscription:
        adj_prob = min(adj_prob * 1.15, 0.95)
    if previous_failures > 10:
        adj_prob *= 0.85
    
    recovered = 1 if random.random() < adj_prob else 0
    
    return {
        'amount': amount,
        'payment_method': payment_method,
        'failure_category': failure_category,
        'attempt_number': attempt_number,
        'previous_success_rate': round(previous_success_rate, 3),
        'previous_failures': previous_failures,
        'customer_tenure_days': customer_tenure_days,
        'subscription': int(subscription),
        'recovered': recovered,
    }

def main(n=5000, output_path='dataset/payments.csv'):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    rows = [generate_row(i) for i in range(n)]
    
    fieldnames = list(rows[0].keys())
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    total = len(rows)
    recovered = sum(r['recovered'] for r in rows)
    print(f"Generated {total} rows -> {output_path}")
    print(f"Recovery rate: {recovered/total*100:.1f}%")
    
    cat_counts = {}
    for r in rows:
        cat_counts[r['failure_category']] = cat_counts.get(r['failure_category'], 0) + 1
    print("By category:", cat_counts)

if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    main(n)
