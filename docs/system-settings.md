# Trang System

Mở `gorth://settings/system`. Trang gồm ba mục System, Memory và Power, dùng component primitive, các hàng `p-4`, radio `gap-4` và component Separator. Lỗi thao tác dùng toast; cảnh báo đóng/thoát dùng AlertDialog trên native portal.

## System

- Shortcuts chuyển đến trang Settings / Shortcuts hiện có.
- Graphics acceleration được lưu ngay nhưng chỉ áp dụng trước khi Electron khởi động Chromium ở lần mở app tiếp theo. Trang hiển thị yêu cầu khởi động lại khi cần. Tắt sử dụng `app.disableHardwareAcceleration()`.
- Proxy mở thiết lập hệ điều hành, không tự thay đổi proxy: Windows mở `ms-settings:network-proxy`; macOS mở Network / Proxies; Linux mở GNOME Network nếu có `gnome-control-center`, nếu không thì báo toast để mở thiết lập desktop hoặc dùng trang Proxy của Gorth.
- Close last tab bật: đóng cửa sổ hiện tại khi đóng tab cuối. Tắt: giữ nguyên tab cuối. Nút X, menu tab và phím tắt đóng tab cùng đi qua luồng này.
- Cảnh báo nhiều tab áp dụng khi đóng cửa sổ có nhiều hơn một tab. Cancel giữ cửa sổ và phiên hiện tại.
- Cảnh báo Quit áp dụng khi thoát app, bao gồm ⌘Q trên macOS. Cancel không dừng desktop server và không hủy phiên đăng nhập. Chấp nhận Quit không hỏi thêm cảnh báo đóng từng cửa sổ.
- Fullscreen reminder xuất hiện qua toast khi vào toàn màn hình. Esc thoát toàn màn hình của website; toàn màn hình cửa sổ dùng shortcut hệ điều hành.
- Giữ lại Smooth scrolling của trang cũ, có hiệu lực sau khi khởi động lại.

URL proxy macOS được đối chiếu với [implementation của Chromium](https://chromium.googlesource.com/chromium/src/base/+/121663451b5528be114956be2c939ecc1d31551b/mac/mac_util.mm); URI Windows theo [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings).

## Memory

- Moderate: 60 phút; Balanced: 15 phút; Maximum: 5 phút. Tiếp tục lưu vào `sleepAfterMinutes` của phiên hiện có, không tạo một giá trị timeout thứ hai dễ lệch nhau. Timeout tùy chỉnh trước đây được giữ đến khi người dùng chọn một mức mới.
- Tab active, split, pinned, grouped, toàn màn hình, media đang phát, capture, download hoặc biểu mẫu đã chỉnh sửa được bảo vệ như trước.
- Always keep these sites active nhận hostname, có thể nhập `example.com` hoặc `https://example.com/`; áp dụng cả subdomain, không áp dụng nhầm `notexample.com`. Không nhận đường dẫn, port, query hay credentials.
- Website trong danh sách không bị tự ngủ hoặc tự archive; tab đã ngủ sẽ được đánh thức ở lượt kiểm tra kế tiếp. Ngoại lệ cũng được áp dụng khi phục hồi phiên.
- Giữ tính năng archive theo ngày và nút mở danh sách archived tabs của trang cũ.
- Chu kỳ kiểm tra tab là 30 giây, nên thời điểm thực tế có thể trễ tối đa khoảng một chu kỳ so với timeout khi app đang hoạt động.

## Power và giới hạn

- Hai chế độ: chỉ khi dùng pin và pin ≤20%, hoặc bất cứ khi nào dùng pin.
- Main đọc pin qua `pmset` trên macOS, PowerShell CIM trên Windows, `/sys/class/power_supply` trên Linux. Trên macOS/Windows, nguồn AC/pin được đối chiếu với Electron `powerMonitor`.
- Cập nhật mỗi 30 giây và khi hệ thống báo chuyển nguồn điện hoặc resume. Không đọc được phần trăm thì chế độ ≤20% không tự kích hoạt. Không xác định được nguồn điện thì Energy Saver không tự kích hoạt.
- Khi hoạt động: giảm hoạt ảnh/transition/smooth scrolling của giao diện browser và giảm timeout ngủ tab nền an toàn xuống tối đa 5 phút, kể cả khi Memory Saver tắt. Không thay đổi timeout người dùng đã lưu; hết điều kiện tiết kiệm pin thì chính sách gốc được phục hồi.
- Không giới hạn FPS hay thay đổi playback video của website. Đây không phải implementation nội bộ Energy Saver của Brave/Chrome. [Electron chỉ hỗ trợ `setFrameRate` cho offscreen rendering](https://www.electronjs.org/docs/latest/api/web-contents#contentssetframeratefps), trong khi browser dùng WebContentsView thông thường.
- Adapter Windows/Linux đã có implementation nhưng chưa xác minh trên máy Windows/Linux thực trong lần thay đổi này. Nút proxy cũng không được tự động mở trong test để tránh thay đổi giao diện hệ điều hành của người dùng.

## Lưu trữ và bảo mật

Các thiết lập System, danh sách ngoại lệ và lựa chọn Energy Saver lưu trong SQLite hiện có, key `systemPreferences`, không thêm migration/table. Memory Saver và timeout tiếp tục dùng snapshot hiện tại. Mọi endpoint `system:*` chỉ cho main frame của chrome renderer thuộc cửa sổ browser đã đăng ký; web tabs, iframe và renderer đã điều hướng sang URL khác bị từ chối. Payload ghi cấu hình được kiểm tra bằng Zod, không có IPC chạy lệnh hoặc mở URL tùy ý.

## Kiểm thử

```sh
pnpm exec vitest run tests/vitest/system-policy.test.ts tests/vitest/system-ipc.test.ts tests/vitest/system-lifecycle.test.ts tests/vitest/system-native.test.ts
pnpm exec tsc --noEmit --incremental false
pnpm exec tsc --noEmit --incremental false -p tests/tsconfig.json
pnpm run lint
```

Native test dùng Electron thật, preload sandbox, IPC thật, SQLite thật và profile tạm; kiểm tra ba mục, radio gap, thêm/xóa website, lưu qua mở lại database, graphics restart flag, điều hướng shortcuts, Cancel đóng nhiều tab, Cancel Quit và đóng tab cuối. Không dùng profile hoặc credentials của người dùng.

Kết quả xác minh ngày 20/10/2026: TypeScript ứng dụng và test, lint, build production renderer/main/preload và kiểm thử System đều qua. Main/preload được build CJS bằng Vite với entry/config tương ứng và Node/Electron externals, không chạy package/rebuild dependency. Nhóm System + development lifecycle có 28 test qua; native System và window-factory có 7 test qua. Build còn cảnh báo chunk renderer lớn và directive `use client` của Lucide trong main, không phải lỗi build. Lần chạy nhóm kiểm thử không-native rộng hơn còn 5 lỗi ngoài System: `settings-spacing.test.ts` (1), `shared-packages.test.ts` (1), `sidebar-border.test.ts` (2), `update-ipc.test.ts` (1). Không thay đổi các phần UI/update đó trong tác vụ này.
