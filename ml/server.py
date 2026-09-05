"""
RecoverAI ML — Flask API Server
Exposes the trained model for recovery probability prediction.
"""
import pickle
import json
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

MODEL = None
METADATA = None
PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet']
CATEGORIES = ['TRANSIENT', 'SOFT_DECLINE', 'HARD_DECLINE', 'CUSTOMER_ACTION_REQUIRED', 'UNKNOWN']

def load_model():
    global MODEL, METADATA
    with open('model.pkl', 'rb') as f:
        MODEL = pickle.load(f)
    with open('model_metadata.json') as f:
        METADATA = json.load(f)
    print(f"Model loaded: {METADATA['model_type']} v{METADATA['model_version']}")
    print(f"   F1={METADATA['metrics']['f1']}, ROC-AUC={METADATA['metrics']['roc_auc']}")

def build_features(data):
    """Build feature vector from request data."""
    features = [
        float(data.get('amount', 0)),
        float(data.get('attempt_number', 1)),
        float(data.get('previous_success_rate', 0)),
        float(data.get('previous_failures', 0)),
        float(data.get('customer_tenure_days', 0)),
        float(data.get('subscription', 0)),
    ]
    method = data.get('payment_method', '')
    for m in PAYMENT_METHODS:
        features.append(1.0 if method == m else 0.0)

    category = data.get('failure_category', '')
    for c in CATEGORIES:
        features.append(1.0 if category == c else 0.0)

    return np.array(features).reshape(1, -1)

@app.route('/health', methods=['GET'])
def health():
    if MODEL is None:
        return jsonify({'status': 'error', 'message': 'Model not loaded'}), 503
    return jsonify({
        'status': 'ok',
        'model_type': METADATA['model_type'],
        'model_version': METADATA['model_version'],
        'metrics': METADATA['metrics'],
    })

@app.route('/predict', methods=['POST'])
def predict():
    if MODEL is None:
        return jsonify({'error': 'Model not loaded'}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    try:
        X = build_features(data)
        prob = float(MODEL.predict_proba(X)[0][1])

        return jsonify({
            'recovery_probability': round(prob, 4),
            'model_version': METADATA['model_version'],
            'model_type': METADATA['model_type'],
            'input_features': {
                'amount': data.get('amount'),
                'payment_method': data.get('payment_method'),
                'failure_category': data.get('failure_category'),
                'attempt_number': data.get('attempt_number'),
            },
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/metadata', methods=['GET'])
def metadata():
    if METADATA is None:
        return jsonify({'error': 'Model not loaded'}), 503
    return jsonify(METADATA)

if __name__ == '__main__':
    load_model()
    app.run(host='0.0.0.0', port=5001, debug=False)
