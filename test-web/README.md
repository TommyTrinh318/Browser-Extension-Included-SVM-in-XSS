# Trang Web kiểm thử Extension

## Chạy thử

Mở PowerShell tại thư mục chứa `test-web` và chạy:

```powershell
python -m http.server 8765 --directory test-web
```

Sau đó mở:

```text
http://127.0.0.1:8765/index.html
```

## Kịch bản

- `benign.html`: trang hợp lệ, không có payload.
- `reflected.html`: nhập dữ liệu rồi gửi vào tham số `q` của URL để kiểm tra Reflected XSS.
- `stored.html`: nhập nội dung rồi thêm vào DOM để kiểm tra `MutationObserver`.

Ví dụ payload để thử:

```text
<script>alert(1)</script>
<img src=x onerror=alert(1)>
javascript:alert(1)
<a href="javascript:alert(1)">Click thử</a>
```


