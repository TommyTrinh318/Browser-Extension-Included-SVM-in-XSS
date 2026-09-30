# Browser Extension phát hiện và ngăn chặn XSS bằng SVM

Đồ án xây dựng Browser Extension nhằm hỗ trợ phát hiện và giảm thiểu tấn công Cross-Site Scripting (XSS) trên ứng dụng Web bằng mô hình học máy.

Hệ thống tập trung vào hai dạng tấn công:

- Reflected XSS thông qua tham số URL.
- Stored XSS thông qua nội dung nguy hiểm được thêm vào DOM.

## Chức năng chính

- Phân tích URL và các tham số truy vấn.
- Phát hiện chuỗi có dấu hiệu XSS bằng TF-IDF và SVM.
- Theo dõi thay đổi DOM bằng `MutationObserver`.
- Phát hiện các thẻ và thuộc tính nguy hiểm như `script`, `onerror`, `onclick`, `onmouseover`.
- Chặn URL nghi ngờ và chuyển hướng đến trang `blocked.html`.
- Xóa hoặc vô hiệu hóa event handler và URL `javascript:`.
- Hiển thị trạng thái phân tích trong giao diện popup.
- Đối sánh kết quả giữa mô hình Python và JavaScript.

## Kiến trúc thư mục

XSS_ML/
├── extension/
│   ├── manifest.json
│   ├── content.js
│   ├── classifier.js
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   ├── blocked.html
│   └── model/
│       └── model-data.js
├── model/
│   ├── NaiveBayes.py
│   ├── SVM.py
│   ├── KNN.py
│   ├── exportToJS_svm_model.py
│   └── validate_python_js_parity.py
├── test-web/
│   ├── benign.html
│   ├── reflected.html
│   └── stored.html
└── README.md

## Mô hình học máy

Mô hình được huấn luyện bằng Python với các thuật toán:

- Naïve Bayes.
- Support Vector Machine.
- K-Nearest Neighbors.

## Yêu cầu môi trường

- Python 3.x.
- Google Chrome hoặc trình duyệt Chromium.
- Các thư viện Python:
pip install pandas scikit-learn joblib

## Huấn luyện và chuyển đổi mô hình

Mở Terminal tại thư mục `model`: cd model

Huấn luyện các mô hình:
python NaiveBayes.py
python SVM.py
python KNN.py

Chuyển mô hình SVM sang JavaScript: python exportToJS_svm_model.py

Sau khi chạy, file extension/model/model-data.js sẽ được cập nhật.

## Cài đặt Browser Extension

1. Mở trình duyệt Chrome.
2. Truy cập: chrome://extensions
3. Bật **Developer mode**.
4. Chọn **Load unpacked**.
5. Chọn thư mục: extension/

Sau khi thay đổi mã nguồn, chọn **Reload** tại Extension và tải lại trang Web đang kiểm thử.

## Chạy trang Web kiểm thử

Mở Terminal tại thư mục gốc của dự án: python -m http.server 8765 --directory test-web

Mở trình duyệt tại địa chỉ: http://127.0.0.1:8765/index.html

Các trang kiểm thử:
- benign.html: kiểm tra dữ liệu hợp lệ.
- reflected.html: kiểm tra payload trong tham số URL.
- stored.html: kiểm tra payload được thêm vào DOM.
