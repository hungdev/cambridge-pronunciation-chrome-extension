# Cambridge Translator - Chrome Extension

Extension dịch thuật tương tự Google Translate nhưng sử dụng phát âm từ Cambridge Dictionary.

## Tính năng

- Dịch văn bản với nhiều ngôn ngữ
- Phát âm từ Cambridge Dictionary (UK/US)
- Hiển thị phiên âm IPA
- Chọn text trên trang web để dịch nhanh
- Tooltip dịch nhanh khi chọn text
- Context menu (chuột phải) để dịch

## Cài đặt

1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật "Developer mode" ở góc trên bên phải
3. Click "Load unpacked"
4. Chọn thư mục chứa extension này
5. Extension sẽ xuất hiện trong thanh công cụ

## Hướng dẫn sử dụng

### Cách 1: Dùng Popup
1. Click vào icon extension trên thanh công cụ
2. Nhập hoặc paste text cần dịch
3. Chọn ngôn ngữ nguồn và đích
4. Click "Dịch"
5. Với từ tiếng Anh đơn lẻ, click nút phát âm để nghe từ Cambridge

### Cách 2: Chọn text trên trang web
1. Chọn (bôi đen) text trên bất kỳ trang web nào
2. Icon dịch nhanh sẽ xuất hiện
3. Click vào icon để mở popup với text đã chọn
4. Hoặc chuột phải và chọn "Dịch với Cambridge Translator"

### Phím tắt
- `Ctrl + Enter`: Dịch text trong popup

## Cấu trúc file

```
translate/
├── manifest.json          # Cấu hình extension
├── popup.html            # Giao diện popup
├── popup.js              # Logic popup
├── popup.css             # Style popup
├── background.js         # Service worker, fetch Cambridge data
├── content.js            # Script chạy trên trang web
├── content.css           # Style cho tooltip
├── icons/                # Icons cho extension
└── README.md             # File này
```

## Tạo icons

Bạn cần tạo 3 file icon PNG:
- `icons/icon16.png` (16x16px)
- `icons/icon48.png` (48x48px)
- `icons/icon128.png` (128x128px)

Bạn có thể:
1. Tạo bằng Photoshop/GIMP/Figma
2. Sử dụng online tool như https://www.favicon-generator.org/
3. Hoặc tạm thời download icon từ internet

## Cách hoạt động

### Dịch văn bản
- Sử dụng Google Translate API (free tier) để dịch text

### Phát âm Cambridge
1. Extension fetch trang từ điển Cambridge (ví dụ: https://dictionary.cambridge.org/dictionary/english/favorite)
2. Parse HTML để trích xuất:
   - Phiên âm IPA (ví dụ: /ˈfeɪ.vər.ɪt/)
   - URL file audio MP3 (ưu tiên US, fallback UK)
3. Play audio khi user click nút phát âm

### Background Service Worker
- File `background.js` xử lý việc fetch dữ liệu từ Cambridge
- Bypass CORS bằng cách fetch trong background context
- Parse HTML để tìm phiên âm và audio URL

## Lưu ý

1. **Icons**: Bạn cần thêm file icons vào thư mục `icons/` để extension hiển thị đúng
2. **Cambridge API**: Extension scrape trực tiếp từ Cambridge website, có thể bị lỗi nếu Cambridge thay đổi cấu trúc HTML
3. **Google Translate**: Sử dụng free endpoint, có thể bị rate limit nếu dùng quá nhiều
4. **Permissions**: Extension cần quyền truy cập `dictionary.cambridge.org` và `translate.googleapis.com`

## Cải tiến có thể làm

- [ ] Cache kết quả dịch và phát âm
- [ ] Thêm lịch sử dịch
- [ ] Cho phép chọn giọng UK hoặc US
- [ ] Thêm nhiều ngôn ngữ hơn
- [ ] Dark mode
- [ ] Keyboard shortcuts tùy chỉnh
- [ ] Lưu từ vựng yêu thích

## Troubleshooting

### Extension không load
- Kiểm tra Chrome version (cần v88+)
- Kiểm tra lỗi trong `chrome://extensions/`
- Reload extension

### Không có phát âm
- Kiểm tra từ có tồn tại trong Cambridge Dictionary
- Mở console để xem lỗi (F12 trong popup)
- Thử từ khác (ví dụ: "hello", "favorite")

### Không dịch được
- Kiểm tra kết nối internet
- Google Translate API có thể bị block
- Thử reload extension

## License

MIT License - Free to use and modify
