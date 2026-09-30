"""Đối sánh dự đoán của mô hình Python với classifier JavaScript trong Extension.

Chạy từ thư mục model hoặc từ bất kỳ thư mục nào:

    python validate_python_js_parity.py

Kết quả trả về mã 0 khi tất cả mẫu có cùng nhãn và sai số margin/risk nằm
trong ngưỡng cho phép; mã 1 nếu có sai khác; mã 2 nếu thiếu môi trường chạy.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import joblib


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


DEFAULT_SAMPLES = [
    "hello world benign text",
    "https://example.com/products?id=10",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<img src=x onmouseover=alert(1)>",
    "<svg onload=alert(1)>",
    "javascript:alert(1)",
    "?q=%3Cscript%3Ealert(1)%3C/script%3E",
]

NODE_RUNNER = r'''
const fs = require("fs");
const vm = require("vm");

// model-data.js và classifier.js được viết cho content script, nên cung cấp
// biến self khi chạy trong Node để dùng đúng mã nguồn của Extension.
globalThis.self = globalThis;
const modelPath = process.env.XSS_MODEL_DATA_PATH;
const classifierPath = process.env.XSS_CLASSIFIER_PATH;
vm.runInThisContext(fs.readFileSync(modelPath, "utf8"), { filename: modelPath });
vm.runInThisContext(fs.readFileSync(classifierPath, "utf8"), { filename: classifierPath });

const classifier = self.XSSClassifier.createClassifier(self.XSS_MODEL);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const samples = JSON.parse(input);
  const results = samples.map((text) => ({ text, ...classifier.classify(text) }));
  process.stdout.write(JSON.stringify(results));
});
'''


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project-root",
        type=Path,
        default=project_root,
        help="Thư mục gốc XSS_ML (mặc định tự suy ra từ vị trí file).",
    )
    parser.add_argument(
        "--node",
        default=os.environ.get("NODE", "node"),
        help="Đường dẫn Node.js hoặc tên lệnh node trong PATH.",
    )
    parser.add_argument(
        "--samples-file",
        type=Path,
        help="File văn bản, mỗi dòng là một mẫu cần đối sánh.",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=1e-6,
        help="Sai số tối đa cho margin/risk (mặc định 1e-6).",
    )
    return parser.parse_args()


def load_samples(path: Path | None) -> list[str]:
    if path is None:
        return DEFAULT_SAMPLES
    samples = [line.rstrip("\r\n") for line in path.read_text(encoding="utf-8").splitlines()]
    samples = [sample for sample in samples if sample.strip()]
    if not samples:
        raise ValueError(f"File mẫu không có dữ liệu: {path}")
    return samples


def python_predictions(vectorizer, model, samples: list[str]) -> list[dict]:
    matrix = vectorizer.transform(samples)
    margins = model.decision_function(matrix)
    labels = model.predict(matrix)
    results = []
    for index, text in enumerate(samples):
        margin = float(margins[index])
        results.append(
            {
                "text": text,
                "label": int(labels[index]),
                "margin": margin,
                "risk": 1.0 / (1.0 + math.exp(-margin)),
                "matchedFeatures": int(matrix[index].nnz),
            }
        )
    return results


def javascript_predictions(
    node: str, model_data: Path, classifier: Path, samples: list[str]
) -> list[dict]:
    environment = os.environ.copy()
    environment["XSS_MODEL_DATA_PATH"] = str(model_data)
    environment["XSS_CLASSIFIER_PATH"] = str(classifier)
    completed = subprocess.run(
        [node, "-e", NODE_RUNNER],
        input=json.dumps(samples, ensure_ascii=False),
        text=True,
        capture_output=True,
        env=environment,
        check=False,
    )
    if completed.returncode != 0:
        details = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"Node.js không chạy được classifier.js: {details}")
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Node.js trả về dữ liệu không hợp lệ: {completed.stdout!r}") from error


def compare_results(
    python_results: list[dict], javascript_results: list[dict], tolerance: float
) -> bool:
    print("\nĐỐI SÁNH MÔ HÌNH PYTHON VÀ JAVASCRIPT")
    print("=" * 112)
    print(f"{'#':>2}  {'Mẫu kiểm thử':<44} {'Py':>3} {'JS':>3} {'Δmargin':>12} {'Δrisk':>12} {'Kết quả':>10}")
    print("-" * 112)

    all_match = len(python_results) == len(javascript_results)
    for index, (python_result, javascript_result) in enumerate(
        zip(python_results, javascript_results), start=1
    ):
        margin_delta = abs(python_result["margin"] - float(javascript_result["margin"]))
        risk_delta = abs(python_result["risk"] - float(javascript_result["risk"]))
        label_match = python_result["label"] == int(javascript_result["label"])
        features_match = python_result["matchedFeatures"] == int(javascript_result["matchedFeatures"])
        row_match = label_match and features_match and margin_delta <= tolerance and risk_delta <= tolerance
        all_match = all_match and row_match
        sample = python_result["text"].replace("\n", " ")
        if len(sample) > 44:
            sample = sample[:41] + "..."
        print(
            f"{index:>2}  {sample:<44} "
            f"{python_result['label']:>3} {int(javascript_result['label']):>3} "
            f"{margin_delta:>12.3g} {risk_delta:>12.3g} "
            f"{'ĐẠT' if row_match else 'LỆCH':>10}"
        )

    print("-" * 112)
    print(f"Kết luận: {'ĐẠT - mô hình JS khớp mô hình Python.' if all_match else 'LỆCH - cần kiểm tra lại bước chuyển đổi hoặc tokenizer.'}")
    return all_match


def find_node(requested: str) -> str | None:
    direct = Path(requested)
    if direct.exists():
        return str(direct)
    return shutil.which(requested)


def main() -> int:
    args = parse_args()
    root = args.project_root.resolve()
    model_dir = root / "model"
    model_data = root / "extension" / "model" / "model-data.js"
    classifier = root / "extension" / "classifier.js"
    vectorizer_path = model_dir / "tfidf_xss_svm.joblib"
    model_path = model_dir / "svm_xss_model.joblib"

    required = [vectorizer_path, model_path, model_data, classifier]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        print("Thiếu file cần thiết:", file=sys.stderr)
        print("\n".join(f"- {path}" for path in missing), file=sys.stderr)
        return 2

    node = find_node(args.node)
    if node is None:
        print("Không tìm thấy Node.js. Cài Node.js hoặc chạy lại với --node <đường-dẫn-node>.", file=sys.stderr)
        return 2

    try:
        samples = load_samples(args.samples_file)
        vectorizer = joblib.load(vectorizer_path)
        model = joblib.load(model_path)
        python_results = python_predictions(vectorizer, model, samples)
        javascript_results = javascript_predictions(node, model_data, classifier, samples)
        return 0 if compare_results(python_results, javascript_results, args.tolerance) else 1
    except Exception as error:  # noqa: BLE001 - hiển thị lỗi thân thiện khi chạy thực nghiệm
        print(f"Không thể thực hiện đối sánh: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
