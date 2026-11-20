# NDaudio Player – bản demo

App phát nhạc sự kiện (20 slot, EQ / Tone / Tempo riêng từng bài) có khóa bản quyền theo ổ cứng.
Chạy trên Windows. Electron + HTML/CSS/JS thuần, Web Audio API, soundtouchjs.

## Chạy thử

Cần Node.js 18 trở lên.

```bash
npm install
npm run genkeys  # CHỈ CHẠY 1 LẦN: tạo cặp khóa Ed25519 (đã chạy sẵn trong bản demo)
npm start        # App phát nhạc (cho khách)
npm run keygen   # Tool cấp key (cho anh Đức)
npm test         # Test logic tạo/kiểm tra key
```

## Cách dùng app phát nhạc

- Thêm nhạc: bấm **+ Thêm nhạc**, bấm vào slot trống, hoặc kéo thả file .mp3/.wav vào cửa sổ.
- Mỗi slot: Start/Stop, thanh tiến trình, âm lượng riêng, nút × để xóa bài.
- Bấm vào 1 slot để chỉnh ở cột phải: EQ Low/Mid/High (±12 dB), Tone ±6 nửa cung, Tempo 50–150%, nút Reset.
- Master volume ở góc trên. Nút **Dừng tất cả** để tắt nhanh.
- Danh sách bài và thông số được lưu tự động, mở lại app vẫn còn.
  Nếu file nhạc bị xóa hoặc di chuyển, slot sẽ báo lỗi khi bấm Start.

## Cách cấp key

1. Khách mở app lần đầu, màn hình kích hoạt hiện **Mã máy** (dạng `XXXX-XXXX-XXXX-XXXX`). Khách bấm Copy và gửi cho anh Đức.
2. Anh Đức mở `npm run keygen`, điền **Tên khách hàng**, **SĐT**, **Email** (không bắt buộc), dán **Mã máy**, chọn **Thời hạn**
   (1 / 3 / 6 / 12 tháng, vĩnh viễn, hoặc chọn ngày cụ thể), bấm **Tạo key**, copy key gửi lại khách.
3. Khách dán key (dài 108 ký tự, nên copy/dán, không gõ tay), bấm **Kích hoạt**. Key đúng thì app mở và lưu key. Góc trên app ghi hạn bản quyền.

**Lịch sử cấp key** (cột phải của tool): mỗi lần cấp đều được lưu ngày cấp, khách, SĐT, email, mã máy, hạn dùng và key.
Có ô tìm kiếm, nhãn màu hạn dùng (còn hạn / sắp hết trong 30 ngày / hết hạn), nút copy lại key.
Nếu mã máy đã từng được cấp, tool cảnh báo ngay khi nhập (đã cấp mấy lần, cho ai).
Lịch sử lưu tại `%APPDATA%\ndaudio-player-demo\history.json`. **Nên sao lưu file này.**

App khóa lại và báo lỗi rõ ràng khi:
- key sai;
- chép app sang máy khác hoặc thay ổ cứng;
- key hết hạn (dùng được hết ngày hết hạn);
- ngày giờ máy bị chỉnh lùi để né hạn.

Hạn chỉ kiểm tra lúc mở app. Đang chạy sự kiện qua nửa đêm ngày hết hạn thì app không tự tắt.

Cách tính:
- Mã máy = SHA-256(serial ổ cứng chứa ổ C:), lấy 16 ký tự đầu. Serial đọc qua PowerShell `Get-CimInstance Win32_DiskDrive` / `Win32_PhysicalMedia`.
- Key = Base32(3 byte ngày hết hạn + 64 byte chữ ký Ed25519 của "mã máy + hạn"). Sửa ngày trong key thì chữ ký sai, key bị chặn. Kiểm tra hoàn toàn offline.
- Key đã kích hoạt lưu tại `%APPDATA%\ndaudio-player-demo\license.json`. Xóa file này để kích hoạt lại.

## Bảo mật: cặp khóa Ed25519

- `keygen/private.pem` (**private key**): dùng để tạo key. Chỉ nằm trên máy NDaudio. **Không gửi ai, không đưa vào app khách.**
- `config/public.pem` (**public key**): đóng gói trong app phát nhạc, chỉ dùng để kiểm tra key. Khách giải nén app cũng không tạo được key.
- **Sao lưu `keygen/private.pem`** (USB, ổ mạng riêng). Mất file này thì không cấp được key cho các app đã phát hành, phải phát hành lại app với cặp khóa mới.
- Không chạy lại `npm run genkeys` khi đã có `private.pem` (lệnh sẽ từ chối). Tạo cặp khóa mới làm mọi key đã cấp mất hiệu lực.
- Giới hạn: app Electron vẫn có thể bị người rành kỹ thuật sửa code để bỏ qua bước kiểm tra. Khóa bản quyền chỉ ngăn người dùng thường; bảo vệ chính vẫn là hợp đồng và thu tiền trước.
- Bản thật có thể làm thêm server cấp key online (quản lý khách, thu hồi key). Demo chưa làm.

## Đóng gói thành .exe

```bash
npm run dist
```

electron-builder tạo file `dist\NDaudio Player 0.1.0.exe` (bản portable, chạy không cần cài).
Muốn bản có trình cài đặt thì đổi `"target": "portable"` thành `"nsis"` trong `package.json`.

Bản đóng gói chỉ chứa app phát nhạc. Tool cấp key giữ ở máy anh Đức, **không** gửi cho khách.
