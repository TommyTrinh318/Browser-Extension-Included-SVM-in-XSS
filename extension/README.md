# XSS Guard ML

Browser extension Manifest V3 phát hiện Reflected XSS trong URL và giám sát các phần tử DOM nguy hiểm bằng mô hình TF-IDF + Linear SVM chạy hoàn toàn trên trình duyệt.

## Cài đặt thử nghiệm

1. Mở `chrome://extensions` hoặc `edge://extensions`.
2. Bật chế độ dành cho nhà phát triển.
3. Chọn **Load UnPack** và trỏ đến thư mục `extension`.
4. Mở một trang HTTP/HTTPS, sau đó bấm biểu tượng extension để xem trạng thái.

## Phạm vi bảo vệ

- URL và tham số truy vấn được giải mã tối đa ba lần rồi phân loại để phát hiện Reflected XSS.
- Các phần tử DOM có thẻ hoặc thuộc tính nguy hiểm được phân loại; phần tử dương tính bị gỡ bỏ hoặc loại bỏ thuộc tính sự kiện/URL JavaScript.
- Toàn bộ suy luận chạy cục bộ, không gửi nội dung trang đến máy chủ.

Extension là nguyên mẫu thực nghiệm phía client, không thay thế việc mã hóa đầu ra, kiểm tra đầu vào và Content Security Policy ở phía ứng dụng Web. Content script không thể bảo đảm chặn mọi inline script trước thời điểm trình duyệt thực thi; kết quả Stored XSS cần được trình bày như cơ chế giảm thiểu và phát hiện.
