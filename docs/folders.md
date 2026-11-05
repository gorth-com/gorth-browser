# Folders

Route: `gorth://settings/folders`.

Browser không thêm mục Folders vào sidebar Settings. About hiển thị các path và Open; danh sách Gorth URLs tại About cũng dẫn tới route Folders.

Path dùng `@gorth/primitive/default/input` ở chế độ read-only để không nhận chuỗi đường dẫn tuỳ ý từ renderer.
Bấm input có thể chỉnh (hoặc Enter khi focus) mở hộp thoại chọn thư mục của hệ điều hành.
Open ở cuối dòng gọi `shell.openPath` trong main process.
Không dùng URL để mở thư mục và không cấp filesystem hoặc shell tuỳ ý qua preload.

## Các vị trí

Application là thư mục chứa app đang chạy; Application data là profile/database/phiên mã hoá.
Hai vị trí này chỉ hiển thị và Open, không đổi nơi cài app hoặc di chuyển profile đang mở.

Browser hiển thị Application, Application data, Downloads, Logs và Session data.
Chỉ Downloads có thể thay đổi. Việc chọn Downloads dùng cùng service/database với Settings → Downloads,
áp dụng ngay cho các lượt tải mới, giữ nguyên tuỳ chọn Ask where to save.
Lịch sử và các file đã tải không bị di chuyển hoặc xoá.
Các path profile/log/session do Electron quản lý nên chỉ cho Open.

## Bảo mật và kiểm thử

IPC kiểm tra cửa sổ sở hữu sender, main frame và URL renderer tin cậy.
Renderer chỉ gửi ID thư mục; main tự resolve path hoặc lấy path từ native dialog.
Path tuỳ ý và các request từ subframe/remote bị từ chối. Lỗi trên giao diện dùng toast.

Unit tests kiểm tra path, routing, IPC và persistence.
Native UI fixture chạy Electron với profile/thư mục tạm và API dialog/Open giả lập.
Nó kiểm chứng input, click và cập nhật UI, **không chứng minh Finder/Explorer hoặc native dialog thật đã được người dùng thao tác**.
Không dùng profile thật, không đổi path thật trong kiểm thử.

