import json
from pathlib import Path

import joblib
project_root = Path(__file__).resolve().parents[1]
default_source = project_root / "model"
default_destination = project_root / "extension" / "model" / "model-data.js"

source = Path(r"C:\Users\Admin\PycharmProjects\XSS_ML\model")
destination = Path(r"C:\Users\Admin\PycharmProjects\XSS_ML\extension\model\model-data.js")

vectorizer = joblib.load(source / "tfidf_xss_svm.joblib")
model = joblib.load(source / "svm_xss_model.joblib")

features = [None] * len(vectorizer.vocabulary_)
for term, index in vectorizer.vocabulary_.items():
    features[index] = term

payload = {
    "format": "tfidf-linear-svm-v1",
    "source": "svm_xss_model.joblib + tfidf_xss_svm.joblib",
    "classes": [int(value) for value in model.classes_],
    "features": features,
    "idf": [float(value) for value in vectorizer.idf_],
    "coef": [float(value) for value in model.coef_[0]],
    "intercept": float(model.intercept_[0]),
    "ngramRange": [1, 2],
    "norm": "l2",
}

destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(
    "self.XSS_MODEL = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"Exported {len(features)} features to {destination}")
