"""
RecoverAI ML — Model Training
Trains a Random Forest classifier to predict payment recovery probability.
Reports precision, recall, F1, ROC-AUC, confusion matrix.
"""
import pandas as pd
import numpy as np
import pickle
import json
import os
import sys
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
from sklearn.calibration import CalibratedClassifierCV, calibration_curve

# ─── Config ──────────────────────────────────────────────────────────────────
DATASET_PATH = 'dataset/payments.csv'
MODEL_PATH = 'model.pkl'
METADATA_PATH = 'model_metadata.json'
RANDOM_STATE = 42
TEST_SIZE = 0.20

PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet']
CATEGORIES = ['TRANSIENT', 'SOFT_DECLINE', 'HARD_DECLINE', 'CUSTOMER_ACTION_REQUIRED', 'UNKNOWN']

def load_and_preprocess(path):
    df = pd.read_csv(path)
    print(f"Loaded {len(df)} rows")
    print(f"Recovery rate: {df['recovered'].mean()*100:.1f}%")
    print(f"Class distribution:\n{df['recovered'].value_counts()}\n")

    # One-hot encode categorical features
    for method in PAYMENT_METHODS:
        df[f'method_{method}'] = (df['payment_method'] == method).astype(int)
    for cat in CATEGORIES:
        df[f'cat_{cat}'] = (df['failure_category'] == cat).astype(int)

    feature_cols = (
        ['amount', 'attempt_number', 'previous_success_rate',
         'previous_failures', 'customer_tenure_days', 'subscription'] +
        [f'method_{m}' for m in PAYMENT_METHODS] +
        [f'cat_{c}' for c in CATEGORIES]
    )

    X = df[feature_cols].values
    y = df['recovered'].values

    return X, y, feature_cols

def train(X_train, y_train):
    # Random Forest (interpretable, handles imbalance well)
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,
        class_weight='balanced',
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    # Calibrate probabilities
    calibrated = CalibratedClassifierCV(clf, cv=3, method='isotonic')
    calibrated.fit(X_train, y_train)
    return calibrated

def evaluate(model, X_test, y_test, feature_cols):
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print("=" * 60)
    print("RECOVERAI ML MODEL — EVALUATION RESULTS")
    print("=" * 60)
    print(f"\nTest set size: {len(y_test)} samples")
    print(f"Precision:  {precision:.4f}")
    print(f"Recall:     {recall:.4f}")
    print(f"F1 Score:   {f1:.4f}")
    print(f"ROC-AUC:    {roc_auc:.4f}")
    print(f"\nConfusion Matrix (rows=actual, cols=predicted):")
    print(f"  TN={cm[0][0]}  FP={cm[0][1]}")
    print(f"  FN={cm[1][0]}  TP={cm[1][1]}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Not Recovered', 'Recovered']))

    # Probability calibration check
    prob_true, prob_pred = calibration_curve(y_test, y_prob, n_bins=10)
    print("\nProbability Calibration (predicted -> actual rate):")
    for pt, pp in zip(prob_pred, prob_true):
        print(f"  Predicted {pt:.2f} -> Actual {pp:.2f}")

    return {
        'precision': round(float(precision), 4),
        'recall': round(float(recall), 4),
        'f1': round(float(f1), 4),
        'roc_auc': round(float(roc_auc), 4),
        'confusion_matrix': cm,
        'test_size': len(y_test),
        'train_size': None,  # filled in main
    }

def main():
    # Generate dataset if not exists
    if not os.path.exists(DATASET_PATH):
        print("Dataset not found. Generating...")
        import generate_dataset
        generate_dataset.main(5000)

    X, y, feature_cols = load_and_preprocess(DATASET_PATH)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")

    print("\nTraining Random Forest (calibrated)...")
    model = train(X_train, y_train)

    metrics = evaluate(model, X_test, y_test, feature_cols)
    metrics['train_size'] = len(X_train)

    # Save model
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nModel saved to {MODEL_PATH}")

    # Save metadata
    metadata = {
        'model_type': 'CalibratedRandomForest',
        'model_version': '1.0',
        'feature_columns': feature_cols,
        'payment_methods': PAYMENT_METHODS,
        'failure_categories': CATEGORIES,
        'metrics': metrics,
        'training_params': {
            'n_estimators': 200,
            'max_depth': 8,
            'test_size': TEST_SIZE,
            'random_state': RANDOM_STATE,
        },
    }
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to {METADATA_PATH}")

    print(f"\nSummary: F1={metrics['f1']:.3f}, ROC-AUC={metrics['roc_auc']:.3f}")

if __name__ == '__main__':
    main()
