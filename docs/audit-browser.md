# Audit Gorth Browser đối chiếu Flow Browser

Ngày đánh giá: **07/10/2026**. Đối tượng: Gorth Browser hiện tại và bản Flow nằm trong `packages/flow-browser`.

## 1. Phạm vi và cách đọc báo cáo

Báo cáo dựa trên mã nguồn tại thời điểm kiểm tra, không dựa vào các yêu cầu tính năng trước đây hoặc danh sách cũ trong `sitemap.txt`. Gorth đang ở commit `66d7253`, worktree sạch trước audit. Flow là snapshot tham khảo tại máy, không phải tuyên bố về phiên bản mới nhất trên upstream.

Trong lúc audit, `package.json` và lockfile có thay đổi bổ sung Vitest/`@vitest/ui` ngoài các chỉnh sửa của báo cáo. Các thay đổi đó được giữ nguyên. Test đã chạy bên dưới vẫn là các harness hiện có; thêm package Vitest không tự chuyển các tests sang Vitest hoặc tạo coverage.

Quy ước:

- **Có**: thấy đường đi triển khai từ UI/API đến xử lý thực tế hoặc persistence. Không có nghĩa là đã kiểm thử toàn bộ các tình huống sản phẩm.
- **Một phần**: có chức năng nhưng phạm vi hẹp, còn thiếu hành vi quan trọng hoặc còn cờ tắt.
- **Placeholder**: chỉ có trang/nhãn/thông báo, chưa có backend hoặc thao tác thực tế.
- **Chưa thấy**: không tìm thấy triển khai trong các vùng nguồn đã kiểm tra; không đồng nghĩa Chromium hoàn toàn không hỗ trợ khả năng đó.

Đã đọc các vùng bootstrap, windows/webviews, IPC/tRPC, persistence, lifecycle, blocker, downloads, auth, portal, shortcuts, routes và UI chính; đối chiếu các controller/module tương ứng của Flow. Chưa chạy UI Flow, chưa kiểm thử mọi website, Windows/Linux, DRM hoặc Chrome Web Store. Kiểm tra native Gorth bị giới hạn bởi binary Electron chưa cài hoàn chỉnh; kết quả cụ thể ở mục 10.

Chỉ tạo tài liệu audit trong lần làm việc này. Không sửa mã ứng dụng, dependency, database người dùng hay `components/ui`.

## 2. Kết luận tổng quan

**Gorth đã vượt khỏi mức browser shell chỉ có tab và address bar.** Đã có SQLite + Drizzle, khôi phục nhiều cửa sổ, nhóm normal/split/glance, sleeping/archive, download manager, shortcuts tùy chỉnh, blocker thực sự và Gorth SSO. Không còn đúng nếu mô tả rằng đóng app mất toàn bộ tab, dữ liệu chỉ dùng localStorage, hoặc chưa có download manager.

**Flow có nền tảng browser-domain rộng hơn**, đặc biệt ở Profiles, Spaces, incognito, Extensions, omnibox, WebAuthn, PDF viewer, cập nhật ứng dụng và tích hợp hệ điều hành. Main process của Flow cũng sở hữu tab và persistence tập trung hơn.

**Không nên coi Flow là mẫu hoàn chỉnh để sao chép nguyên trạng.** Snapshot này vẫn có split layout `TODO`, glance bị tắt mặc định, permission handler cho phép mặc định hầu hết quyền ngoài `openExternal`, và README liệt kê một số tính năng đã triển khai vào nhóm “Upcoming”. Gorth có split layout thực tế, downloads có manager riêng và archive có dữ liệu khôi phục riêng.

Ưu tiên trước khi mở rộng thêm tính năng:

1. Permission/site data và trust boundary của các IPC cũ.
2. Persistence, migration có phiên bản, shutdown và khôi phục dữ liệu.
3. Các hành vi đang có nhưng chưa tương đương browser đầy đủ: Find, recently closed, popup/navigation.
4. Sau đó mới triển khai Profiles/Spaces, Extensions, omnibox và release/update pipeline.

Không chấm “phần trăm giống Flow”, độ an toàn hay tốc độ khi chưa có bộ tiêu chí và benchmark tương ứng.

## 3. Stack và ranh giới kiến trúc

| Hạng mục | Gorth hiện tại | Flow snapshot |
| --- | --- | --- |
| Tên/version | Gorth Browser `0.0.1` | Flow `0.12.0` |
| Electron khai báo | Stock Electron `44.6.0` | Castlabs Electron `v41.1.1+wvcus` |
| Build | Electron Forge + Vite; cấu hình renderer/main/preload riêng | Electron Vite + Electron Builder |
| UI | React, Tailwind, Base UI/shadcn, custom providers | React, Tailwind, Base UI/shadcn, Motion, portal components |
| DB | better-sqlite3 + Drizzle; phần lớn dữ liệu browser trong một DB | SQLite + Drizzle cho tabs/history/pins; datastore riêng cho settings/profiles/spaces và dữ liệu khác |
| Renderer → main | Preload semantic API; một phần chuyển sang tRPC qua IPC | Typed bridge + IPC/controller/event |
| Local HTTP service | Nitro cho callback/profile; dev qua Unix socket/named pipe, production HTTP loopback | Không có backend ứng dụng tương đương trong kiến trúc được mô tả |
| Website surface | Native `WebContentsView` sandboxed | Native `WebContentsView` + LayerManager |

Nguồn: [Gorth package.json](../package.json), [Forge config](../forge.config.ts), [Flow package.json](../packages/flow-browser/package.json), [Flow AGENTS](../packages/flow-browser/AGENTS.md), [Flow DB](../packages/flow-browser/src/main/saving/db/index.ts).

Tên `rollup.config.ts` và `rolldown.config.ts` không chứng minh hai pipeline độc lập: hiện cả hai đều export `defineConfig` của Vite và được Forge Vite plugin nạp. Đây là cách đặt tên cho các target. [Main config](../rollup.config.ts), [preload config](../rolldown.config.ts).

### 3.1. Những điểm Gorth đang làm đúng

- Website views dùng `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, không mang application preload. SSO dùng view/partition riêng. [Webview](../main/windows/webview.ts), [auth view](../main/services/auth-view.ts).
- DB và filesystem nằm main/services; renderer dùng bridge, không import SQLite runtime để tự truy cập file. [Database IPC](../main/ipc/database.ts), [database service](../services/browser-database.ts).
- Portal UI đã dùng React portal vào native surface riêng, không chỉ tăng CSS `z-index` dưới web content. [Portal provider](../providers/portal.tsx), [native portal host](../main/windows/portal.ts).
- Có renderer hydration gate và màn hình loading thay vì render home mặc định trước khi đọc session. [Application](../app/index.tsx), [LoadingScreen](../components/element/loading-screen.tsx).
- Có schema Zod và giới hạn dữ liệu tại một số boundary; tRPC kiểm tra sender, main frame và URL renderer. [Session schema](../lib/browser/session-schema.ts), [RPC IPC](../main/ipc/rpc.ts).
- Forge cấu hình ASAR, native unpack và security fuses. Đây là cấu hình đóng gói, không phải chứng nhận an toàn hoặc bằng chứng đã ký bản phát hành. [Forge config](../forge.config.ts).

### 3.2. Điểm khác biệt quan trọng về ownership

Gorth vẫn để `Application` giữ tabs, groups, bookmarks, history và preferences trong React; main giữ thêm tab metadata/views/lifecycle; renderer gửi snapshot xuống DB sau debounce 250 ms. tRPC hiện chỉ có `session.load` và `groups.list/save/delete`, chưa thay thế toàn bộ IPC. [Application](../app/index.tsx), [RPC router](../main/rpc/router.ts).

Flow quản lý tab, profile, space, active state và tab persistence qua main controllers/events. Tab lifecycle/layout/persistence có trách nhiệm riêng; UI phản ánh trạng thái domain thay vì sở hữu phần lớn snapshot. [Controller overview](../packages/flow-browser/src/main/controllers/README.md), [TabsController](../packages/flow-browser/src/main/controllers/tabs-controller/index.ts), [tab persistence](../packages/flow-browser/src/main/saving/tabs/index.ts).

Hướng nên học: xác định main là nguồn sự thật cho các thao tác browser cần persistence/native effects; renderer giữ interaction state. Không cần sao chép toàn bộ singleton/class architecture của Flow, và không nên chuyển mọi `useState` vào global store chỉ để giảm số dòng.

## 4. Ma trận tính năng

### 4.1. Tabs, cửa sổ và tổ chức phiên

| Tính năng | Gorth | Flow | Nhận xét |
| --- | --- | --- | --- |
| Nhiều tab/cửa sổ | Có | Có | Gorth có session ID riêng cho từng cửa sổ. |
| Khôi phục phiên/bounds | Có | Có | Gorth lưu tabs/groups/active/split/preferences/bounds và phục hồi cửa sổ đánh dấu mở. |
| Recently closed | Có, một phần | Có | Gorth giữ tối đa 25 entry/cửa sổ trong DB; Flow tối đa 10 entry runtime và có phục hồi group membership. |
| Horizontal/vertical tabs | Có, chuyển đổi | Sidebar là UI chính | Flow README còn liệt kê topbar là upcoming; không coi là parity đã hoàn tất. |
| Collapse vertical sidebar | Có | Có UI sidebar riêng | Gorth có trạng thái chỉ icon; không phải browser profile isolation. |
| Pinned/mute/middle-click close | Có | Có pinned/mute | Gorth đã có compact pins, mute và đóng bằng chuột giữa. |
| Tab overflow/tab list | Có | Có tổ chức sidebar/omnibox | Gorth có scroll arrows và menu danh sách tab. |
| Drag reorder/pin/unpin | Chưa thấy | Có | Flow có drag source/drop targets và persistence; Gorth chỉ scroll/select/pin qua action. |
| Normal group có tên | Có | Không thấy mô hình named normal group tương đương | Gorth có nhóm và quản lý từ Bookmarks. |
| Split | Có, đúng hai website tab | Một phần | Flow có model split nhưng layout còn `TODO`. Gorth chia đôi cố định, chưa có resize divider. |
| Glance | Có, hai website tab | Có model/layout, bị cờ tắt | Không đánh dấu glance Flow là mặc định sử dụng được. |
| Sleeping | Có, hủy/recreate view | Có, hủy/recreate view | Cả hai không giữ nguyên DOM/JS heap sau sleep. |
| Archive khôi phục riêng | Có | Một phần khác mô hình | Gorth lưu `archived_tab`; timer Flow gọi `tab.destroy()`, recently closed là runtime có giới hạn. |
| Browser Profiles | Chưa có | Có | Gorth hardcode `PROFILE_ID = "default"`; SSO profile không phải browser profile. |
| Spaces/workspaces | Placeholder trong native menu | Có | Gorth “Default Space” là item disabled; không có CRUD/model Spaces. |
| Incognito | Chưa có | Có | Flow tạo ephemeral profile/session và dọn khi cửa sổ cuối đóng. |

Nguồn Gorth: [Application](../app/index.tsx), [tabs UI](../components/element/browser-tabs.tsx), [vertical tabs](../layouts/vertical-tabs.tsx), [database](../services/browser-database.ts), [lifecycle](../main/services/tab-lifecycle.ts), [webview bounds](../main/windows/webview.ts), [application menu](../main/ipc/application-menu.ts).

Nguồn Flow: [tabs controller](../packages/flow-browser/src/main/controllers/tabs-controller/index.ts), [recently closed](../packages/flow-browser/src/main/controllers/tabs-controller/recently-closed.ts), [recently closed manager](../packages/flow-browser/src/main/controllers/tabs-controller/recently-closed-manager.ts), [drag tab group](../packages/flow-browser/src/renderer/src/components/browser-ui/browser-sidebar/_components/tab-group.tsx), [split layout](../packages/flow-browser/src/main/controllers/tabs-controller/tab-layout.ts), [flags](../packages/flow-browser/src/main/modules/flags.ts), [incognito](../packages/flow-browser/src/main/modules/incognito/windows.ts), [Spaces](../packages/flow-browser/src/main/controllers/spaces-controller/raw.ts).

### 4.2. Navigation, tìm kiếm và nội dung web

| Tính năng | Gorth | Flow | Nhận xét |
| --- | --- | --- | --- |
| Back/forward/reload/stop | Có | Có | Gorth đổi reload thành X khi loading. |
| Address bar short/full URL | Có | Có omnibox riêng | Gorth có focus/select-all và phân màu URL. |
| Omnibox autocomplete | Chưa có engine tương đương | Có | Flow kết hợp history, open tabs, actions, remote search và zero-suggest. |
| Bangs | Chưa có | Có | Flow có dữ liệu bangs và xử lý trong verbatim suggestor. |
| Chọn search engine | Trang thông tin, chưa có selector | Một phần | Snapshot Flow có abstraction nhưng resolver omnibox hiện trả Google; không kết luận hỗ trợ tùy ý mọi engine. |
| Link `target=_blank` | Có, một phần | Có domain orchestration | Gorth gửi URL thành tab mới và deny native popup; chưa bảo toàn mọi window features/POST/opener. |
| Find in page | Có, một phần | Có native implementation | Gorth quét text DOM bằng injected JS, Flow gọi `webContents.findInPage`. |
| HTML fullscreen | Có | Có | Gorth theo dõi tab fullscreen và trạng thái OS trước khi vào fullscreen web. |
| Automatic PiP khi đổi tab | Chưa thấy | Có code | Gorth chỉ bảo vệ tab PiP khỏi sleep; chưa có orchestration tương đương. |
| PDF viewer riêng | Chưa thấy | Có | Gorth có thể phụ thuộc Chromium mặc định; chưa xác nhận runtime PDF. |
| Widevine/DRM integration | Chưa có | Có build nền Castlabs | Không đồng nghĩa mọi dịch vụ DRM chạy được; chưa thử playback. |
| WebAuthn/passkeys integration | Chưa có module riêng | Có | Không đánh đồng “chưa có module” với mọi WebAuthn Chromium đều không hoạt động. |
| HTTP/proxy Basic Auth UI | Chưa thấy handler riêng | Có | Flow có `app.on("login")` và prompt queue. |
| Error/offline page | Có | Có | Gorth có Retry, mã lỗi và Offline rocket; Flow có games routes riêng. |
| Save image as/content menu | Có | Có | Gorth đã phân biệt tab/titlebar/address/web menu và có thao tác image/link/edit/devtools. |

Nguồn Gorth: [AddressBar](../layouts/address-bar.tsx), [navigation IPC/Find](../main/ipc/browser.ts), [native views/events](../main/windows/capital.ts), [Find UI](../components/element/find-in-page.tsx), [context menu](../main/ipc/context-menu.ts), [error page](../pages/error/index.tsx), [search settings](../pages/settings/search/index.tsx).

Nguồn Flow: [omnibox suggestor](../packages/flow-browser/src/renderer/src/lib/omnibox-new/suggestor.ts), [verbatim/bangs](../packages/flow-browser/src/renderer/src/lib/omnibox-new/suggestors/verbatim.ts), [search resolver](../packages/flow-browser/src/renderer/src/lib/omnibox-new/search-providers/index.ts), [native Find](../packages/flow-browser/src/main/ipc/browser/find-in-page.ts), [PiP/fullscreen](../packages/flow-browser/src/main/controllers/tabs-controller/tab-lifecycle.ts), [PDF intercept](../packages/flow-browser/src/main/controllers/sessions-controller/intercept-rules/better-pdf-viewer.ts), [WebAuthn](../packages/flow-browser/src/main/ipc/webauthn/index.ts), [Basic Auth](../packages/flow-browser/src/main/app/basic-auth.ts), [games](../packages/flow-browser/src/renderer/src/routes/games/page.tsx).

### 4.3. Data, bảo vệ, extensions và hệ điều hành

| Tính năng | Gorth | Flow | Nhận xét |
| --- | --- | --- | --- |
| History | Có | Có | Flow có URLs/visits, visitCount/typedCount; Gorth lưu visit item đơn giản và load tối đa 2.000 item. |
| Bookmarks | Có | Chưa thấy manager tương đương | Flow pins/spaces không phải bookmark manager với cùng mô hình. |
| Download manager | Có | Chưa thấy manager tương đương | Flow có `downloadURL` từ context menu, không phải UI/persistence/pause/retry manager. |
| Ad/tracker blocker | Có | Có | Cả hai dùng Ghostery; không phải Brave Rust engine. |
| Site exceptions/custom filters | Có | Chưa thấy UI/contract tương đương trong module blocker | Gorth có cache, bundled engine, update lists và custom filters. |
| Permission manager theo site | Chưa có cho website thường | Một phần, chính sách quá rộng | Flow prompt `openExternal`, còn phần lớn request khác `callback(true)`. |
| Cookies/site data management UI | Một phần thông tin | Chưa xác nhận đầy đủ | Gorth lấy cookie count, chưa có manager xóa/quản lý quyền site. |
| Chrome Web Store extensions | Placeholder | Có | Flow có session integration, install prompt, manager, service worker và popup. |
| Gorth SSO | Có | Không thấy tích hợp tương đương | Gorth dùng OAuth/OIDC/PKCE, main giữ token; không cần host Better Auth server trong renderer. |
| Browser cloud sync | Placeholder | Chưa xác nhận có sync tương đương | Đăng nhập SSO không tạo ra sync tabs/bookmarks/settings. |
| Custom shortcuts | Có | Có | Gorth có list/edit/reset, chống trùng và bảo vệ phím native. |
| Native app menu | Có | Có | Gorth có File/Edit/View/Tabs/Spaces/Window; Spaces chưa hoạt động, chưa có Help submenu riêng. |
| About OS → Help | Có | Có UI About/settings riêng | Gorth chuyển đến `gorth://settings/help`. |
| OS default browser/URL open | Chưa có đầy đủ | Có | Gorth second-instance chỉ focus cửa sổ, chưa xử lý URL từ OS thành tab. |
| macOS Handoff | Chưa có | Có code | Chưa test hoạt động trên thiết bị thật. |
| App auto-update | Chưa có | Có | `publish` Forge không tự tạo updater runtime. |
| Packaging/signing/notarization | Có packaging, chưa thấy signing/notarization config | Có cấu hình release chi tiết | Không khẳng định đã ký/phát hành thành công chỉ từ config. |

Nguồn Gorth: [DB/schema](../database/schema.ts), [DB operations](../services/browser-database.ts), [downloads](../main/services/downloads.ts), [downloads UI](../pages/downloads/index.tsx), [blocker](../main/services/content-blocker.ts), [Shields settings](../pages/settings/shields/index.tsx), [extensions placeholder](../pages/extensions/index.tsx), [SSO](../lib/auth/gorth.ts), [vault](../lib/auth/vault.ts), [shortcuts](../main/ipc/shortcuts.ts), [Forge](../forge.config.ts).

Nguồn Flow: [DB schema](../packages/flow-browser/src/main/saving/db/schema.ts), [content blocker](../packages/flow-browser/src/main/modules/content-blocker.ts), [session permissions](../packages/flow-browser/src/main/controllers/sessions-controller/handlers/index.ts), [loaded profile/extensions](../packages/flow-browser/src/main/controllers/loaded-profiles-controller/index.ts), [extension manager](../packages/flow-browser/src/main/modules/extensions/management.ts), [web context menu](../packages/flow-browser/src/main/controllers/tabs-controller/context-menu.ts), [default browser](../packages/flow-browser/src/main/controllers/default-browser-controller/index.ts), [OS URL handling](../packages/flow-browser/src/main/app/urls.ts), [Handoff](../packages/flow-browser/src/main/controllers/handoff-controller/index.ts), [updater](../packages/flow-browser/src/main/controllers/auto-update-controller/index.ts), [release config](../packages/flow-browser/electron-builder.ts).

## 5. Các trang Settings: thực chất đã có đến đâu?

Không nên dùng việc sidebar có đủ mục làm bằng chứng browser đã có đủ tính năng tương ứng.

| Nhóm trang | Trạng thái thực tế |
| --- | --- |
| `settings/appearance` | Có theme light/dark/system, vertical tabs, logo titlebar, vị trí sidebar và toast settings. |
| `settings/system` | Có memory saver, sleep timeout, archive timeout, mở Archive và smooth scrolling cần restart. |
| `settings/shields` | Có trạng thái engine, bật/tắt, exceptions, custom filters và cập nhật lists. |
| `settings/downloads` | Có chọn thư mục, tùy chọn hỏi nơi lưu, thao tác bridge thực tế. |
| `settings/profile` | Có Gorth account/SSO UI, chưa có nhiều browser profiles. |
| `settings/get-started` | AccountCard và mô tả startup; chưa có wizard/selector startup behavior tương đương Flow. |
| `settings/search` | Chỉ mô tả hiện dùng Google; chưa chỉnh được engine. |
| `settings/help`, `help`, `welcome`, `whats-new` | Có trang nội dung/đường dẫn; chưa có updater hay onboarding state machine chỉ vì tồn tại các trang này. |
| `extensions`, `settings/extensions` | Placeholder; chưa cài, bật/tắt hay gỡ extension được. |
| `settings/content`, `privacy`, `web3`, `leo`, `sync`, `autofill`, `languages`, `accessibility`, `reset` | Placeholder với thông báo preferences chưa có. |
| `flags` | Hai cờ memory saver/smooth scrolling có xử lý; không phải bảng flags Chromium đầy đủ. |

Nguồn: [settings composition](../pages/settings/index.tsx), [settings pages](../pages/settings), [flags](../pages/flags/index.tsx), [internal routes](../lib/browser/internal-pages.ts).

Flow có các section thực tế cho profiles, spaces, shortcuts, external apps, default browser, updates và icon. Điều này không có nghĩa Flow có toàn bộ Privacy/Autofill/Sync như Chrome/Brave. [Flow settings sections](../packages/flow-browser/src/renderer/src/components/settings/sections).

### 5.1. UI/layout đã có và giới hạn chưa kiểm chứng

- Wrapper dùng `container mx-auto min-w-0 flex-1 p-6`, có Settings dashboard riêng, titlebar/addressbar và vertical-tabs layout riêng. Tuy nhiên Profile page vẫn có wrapper `max-w-3xl p-6` riêng: chưa đồng nhất hoàn toàn mọi page. [Wrapper](../layouts/wrapper.tsx), [profile page](../pages/settings/profile/index.tsx).
- Tabs cơ bản 180 px, horizontal tabs có thể co đến `min-w-24`; tooltip 180 px, title tối đa hai dòng. Mute/close hiện khi hover/active; compact/pinned tab chỉ icon. Addressbar tooltips 90 px với alignment theo phía. [Tabs](../components/element/browser-tabs.tsx), [AddressBar](../layouts/address-bar.tsx).
- Downloads popup có bốn slot gần đây và Show all, item `h-9`, `gap-1`, separator. [Recent downloads](../components/element/recent-downloads.tsx).
- Tooltip/toast custom có portal để đứng trên native web contents và đồng bộ theme; không sửa primitive UI để ép native layering. Khả năng hết giật/nháy trên máy thật chưa được xác nhận trong lần audit do native runtime bị chặn.
- UI chưa hoàn toàn English/i18n: AuthGuard và một số thông báo lỗi/bootstrap còn tiếng Việt. Đây là nợ consistency, không phải lỗi kết nối hoặc auth. [Guard](../layouts/guard.tsx), [bootstrap](../app/main.ts).

## 6. Các phát hiện cần xử lý ở Gorth

Các mức ưu tiên dưới đây là ưu tiên kỹ thuật theo impact; không phải CVSS. Không chứng minh được exploit P0 trong lần audit này.

### P1-01 — Website permissions và site data chưa có chính sách sản phẩm

**Bằng chứng:** website `WebContentsView` dùng session mặc định, không thấy `setPermissionRequestHandler`/`setPermissionCheckHandler` cho website thường. Hai handler deny chỉ thấy trong SSO partition. Site-info lấy `https` từ scheme và cookie count, không có certificate inspector hoặc permission/site-data manager. `settings/privacy` và `settings/content` còn placeholder. [Webview](../main/windows/webview.ts), [auth view](../main/services/auth-view.ts), [site-info handler](../main/ipc/context-menu.ts).

**Ảnh hưởng:** ứng dụng chưa tự kiểm soát trải nghiệm xin quyền, lưu quyết định, thu hồi quyền hoặc xóa dữ liệu theo site. Chưa có bằng chứng runtime về cách từng quyền được Chromium/OS xử lý nên không kết luận mọi quyền đang tự động được cho phép.

**Đề xuất:** policy rõ theo session + requesting origin/frame, default deny với quyền chưa hỗ trợ, prompt cần thiết, lưu và thu hồi quyết định theo site; chỉ báo HTTPS không thay thế thông tin certificate. Không sao chép `callback(true)` của Flow cho mọi quyền.

### P1-02 — Một số IPC legacy chưa chặt như boundary tRPC

**Bằng chứng:** `desktop:rpc` kiểm tra main frame và URL renderer; nhiều handler database/browser/menu chỉ dựa vào `getWindowFromSender` hoặc identity WebContents. Layout IPC đọc fields trực tiếp; chỉ `verticalTabsWidth` kiểm tra finite, còn `top/sidebarWidth` không có schema tương đương. Renderer navigation guard chỉ so origin, không giới hạn chính xác path chrome. [RPC IPC](../main/ipc/rpc.ts), [database IPC](../main/ipc/database.ts), [browser IPC](../main/ipc/browser.ts), [capital window](../main/windows/capital.ts).

**Ảnh hưởng:** API surface không đồng nhất; payload malformed có thể gây lỗi và cùng-origin document không phải chrome là tình huống cần kiểm thử. Website views không có application preload, nên đây không phải bằng chứng website bất kỳ gọi được privileged API.

**Đề xuất:** dùng chung kiểm tra owner + trusted URL + main frame cho privileged handlers; validate payloads/IDs/finite bounds và ownership. Giữ exceptions chỉ cho API thật sự cần nhận từ website, ví dụ cosmetic IPC đã kiểm tra view và frame URL.

### P1-03 — Schema Drizzle và migration runtime có hai nguồn định nghĩa

**Bằng chứng:** có `drizzle.config.ts` và `database/schema.ts`, nhưng `initializeDatabase` tạo/alter phần lớn tables bằng SQL thủ công và `PRAGMA table_info`; `database/migrations` chỉ có migration user profiles dạng TypeScript, không thấy runtime gọi Drizzle migrator cho toàn DB. [Drizzle config](../drizzle.config.ts), [schema](../database/schema.ts), [bootstrap DB](../services/browser-database.ts).

**Ảnh hưởng:** generate migration không tự bảo đảm app áp dụng migration; dễ lệch schema khi đổi kiểu/cột/index. `foreign_keys = ON` không tự sinh FK: nhiều ID quan hệ trong schema chưa có `.references(...)`.

**Đề xuất:** chọn migration có version/journal, chạy transaction, hỗ trợ upgrade DB cũ và failure recovery; thêm constraint phù hợp cùng tests orphan groups/members. Flow có runtime `migrate(db, { migrationsFolder })` và copy migrations vào resources, đáng học phần này. [Flow DB runtime](../packages/flow-browser/src/main/saving/db/index.ts).

### P1-04 — Persistence vẫn phụ thuộc snapshot renderer và sync flush

**Bằng chứng:** state chính ở `Application`; save snapshot debounce 250 ms, `void ...save(...)` không có catch tại effect; `beforeunload` dùng sync flush. DB transaction xóa/reinsert toàn bộ open tabs của cửa sổ. Window close hủy view với `waitForBeforeUnload: false`. [Application](../app/index.tsx), [database service](../services/browser-database.ts), [destroy view](../main/windows/webview.ts), [close window](../main/windows/capital.ts).

**Ảnh hưởng:** có cửa sổ mất thay đổi chưa flush khi crash; lỗi save nền chưa có phản hồi UI; một lần tab update có thể kéo theo serialize/save snapshot lớn. Khi đóng tab có form chưa lưu, protection của sleeping không đồng nghĩa có beforeunload confirmation khi close.

**Đề xuất:** main-owned mutations có transaction, dirty entities/delta save; báo lỗi persistence rõ; quit coordinator đợi các flush quan trọng và xử lý beforeunload theo chính sách. Flow có quit coordinator, đợi tab persistence và flush storage/cookies, nhưng `canQuit()` của snapshot Flow cũng còn trả true trực tiếp. [Flow shutdown](../packages/flow-browser/src/main/controllers/quit-controller/handlers/before-quit.ts).

### P2-01 — Find in page chưa dùng native search engine

**Bằng chứng:** handler quét `TreeWalker` trong `document.body`, tạo ranges/highlights và giới hạn 10.000 match. Không gọi native `findInPage`, dù vẫn có listener `found-in-page`. [Browser IPC](../main/ipc/browser.ts).

**Giới hạn suy ra từ code:** không tìm xuyên nhiều text nodes/iframe/shadow DOM theo cách native; không lọc đầy đủ text bị ẩn; `window.__gorthFindState` và các DOM IDs cùng nằm trong trang web; lowercase có thể đổi độ dài ký tự trong một số Unicode case. Quét lại document trên mỗi query có thể tốn thời gian ở trang lớn; chưa benchmark.

**Đề xuất:** chuyển sang `webContents.findInPage`/`stopFindInPage`, correlate tab + request ID, bỏ kết quả cũ khi đổi query/tab. Flow có implementation mẫu đúng hướng. [Flow Find](../packages/flow-browser/src/main/ipc/browser/find-in-page.ts).

### P2-02 — Reopen closed tab giữ record nhưng chưa phục hồi đầy đủ

**Bằng chứng:** DB lưu `PersistedTab` gồm navigation history, nhưng `reopenClosedTab` lại gọi `tabs.navigate(id, closed.url)` cho website; navigate xóa `metadata.navigation`. Entry không chứa group snapshot/old position và renderer append tab ở cuối. [reopen flow](../app/index.tsx), [navigation IPC](../main/ipc/browser.ts), [recently closed DB](../services/browser-database.ts).

**Ảnh hưởng:** Cmd/Ctrl+Shift+T mở lại được website nhưng không bảo đảm Back/Forward cũ, vị trí cũ hay group membership. Khôi phục pinned/muted metadata không tương đương khôi phục toàn bộ phiên tab.

**Đề xuất:** restore từ persisted navigation qua main-owned API; lưu position và group metadata; xác định chính sách khi group cũ đã bị xóa. Flow đã có `restoreTabGroupMembership` để tham khảo, nhưng recently closed của Flow không tồn tại qua restart.

### P2-03 — QUIC recovery đã có, không phải bằng chứng lỗi tRPC/network đã được giải thích hoàn toàn

**Bằng chứng:** `loadWebsite` retry một lần GET khi errno `-356`; không replay form POST, không retry TLS/DNS/abort; callback tránh chuyển sang error page khi còn recovery. Không có switch disable QUIC. [Navigation service](../main/services/navigation.ts), [view error handling](../main/windows/capital.ts).

**Giới hạn:** reload/force-reload gọi native trực tiếp; navigation-history restore và các navigation do website tạo không đều đi qua helper. Retry không sửa mọi nguyên nhân HTTP/3/network. Không có packet trace/net log trong audit để khẳng định nguyên nhân gốc.

**tRPC hiện tại:** URL `https://desktop.invalid/trpc` chỉ dùng định dạng request; custom fetch đưa dữ liệu qua `electronAPI.rpc.request` và main chạy Fetch adapter in-memory, không gọi mạng đến hostname đó. Không có bằng chứng từ code này rằng tRPC tự thay cấu hình QUIC. [RPC client](../lib/rpc/client.ts), [transport](../main/rpc/transport.ts).

**Đề xuất:** giữ QUIC; giữ regression tests cho lỗi lần đầu, lỗi liên tục, Stop và replacement navigation. Chỉ bổ sung recovery cho đường còn thiếu khi đã kiểm chứng an toàn, không auto-replay navigation có side effects.

### P2-04 — Chia sẻ bookmark/history giữa cửa sổ chưa có live synchronization

**Bằng chứng:** `sharedBaselines` áp delta theo từng window, tránh snapshot cũ xóa dữ liệu mới. Renderer còn giữ arrays riêng; không thấy subscription cập nhật bookmark/history giữa các cửa sổ. Preferences shell lưu theo window, trong khi Shields/downloads/shortcuts là shared. [Database service](../services/browser-database.ts), [Application](../app/index.tsx).

**Ảnh hưởng:** đã tránh một lớp ghi đè dữ liệu, nhưng UI cửa sổ khác có thể không thấy thay đổi ngay; semantics settings chưa hoàn toàn đồng nhất.

**Đề xuất:** định nghĩa rõ global/profile/window settings; main phát data-changed, renderer invalidate Query có chọn lọc. Không coi baseline merge là sync realtime hoặc cloud sync.

### P2-05 — History là danh sách đơn giản, chưa có retention/domain model đầy đủ

**Bằng chứng:** history được thêm từ React khi tab URL thay đổi; load giới hạn 2.000 entry, save chỉ lấy 2.000 entry đầu; không thấy job prune theo retention như Flow. [Application](../app/index.tsx), [DB history](../services/browser-database.ts).

**Ảnh hưởng:** số entry load không chứng minh DB bị giới hạn tương ứng; old visits có thể còn lưu mà UI không load. Chưa có visit/typed count để xếp hạng omnibox. Việc restore cập nhật tab cũng cần test không tạo visit giả.

**Đề xuất:** main ghi visit khi navigation commit với loại transition; retention rõ, prune có test; URLs/visits nếu cần scoring lịch sử. Flow có schema này và prune lúc DB init. [Flow schema](../packages/flow-browser/src/main/saving/db/schema.ts).

### P2-06 — Portal đã đúng hướng, vẫn cần kiểm thử lifecycle và chi phí

**Bằng chứng:** pool Gorth tái sử dụng menu/tooltip/toast nhưng chưa thấy giới hạn idle pool; mỗi surface đồng bộ styles/theme qua observer. Tooltip còn mirror DOM và dùng animation frame để theo dõi vị trí. Tooltip/toast là non-focusable child windows; menus dùng native views. [Portal provider](../providers/portal.tsx), [Tooltip provider](../providers/tooltip.tsx), [Toaster provider](../providers/toaster.tsx), [native portal host](../main/windows/portal.ts).

**Ảnh hưởng:** còn chi phí renderer/window/observer riêng; `duration-200` không tự giải quyết mọi race focus, stale tooltip hoặc native layering. Chưa đo RAM/CPU/latency nên không kết luận pool hiện gây leak.

**Đề xuất:** giới hạn idle pool hợp lý, cleanup khi HMR/owner destroy, instrumentation; regression hover nhanh, open-close liên tục, chuyển theme, resize/fullscreen, split/glance. Học LayerManager/focus priorities của Flow khi số lớp tăng; không cần thêm coordinator nặng chỉ để có cùng tên file.

### P2-07 — Context menu theme và native action focus còn cần rà soát

**Bằng chứng:** web-content context menu lấy theme từ `nativeTheme.shouldUseDarkColors`, trong khi app có light/dark override. `sendAppAction` gửi vào `BrowserWindow.getFocusedWindow()`, còn tooltip/toast cũng là BrowserWindow và có thể được liệt kê trong global windows. Native menu DevTools dùng role mặc định, không resolve active website như Flow. [capital events](../main/windows/capital.ts), [native action](../main/ipc/native-menu.ts), [application menu](../main/ipc/application-menu.ts).

**Ảnh hưởng:** có nguy cơ web context menu khác theme app khi user override OS; menu/shortcut cần target đúng browser owner khi có portal hoặc khi macOS app chưa có cửa sổ. Đây là nhận định tĩnh cần kiểm thử, không khẳng định mọi tình huống đều đang lỗi.

**Đề xuất:** resolve registered browser owner + active website; chọn DevTools shell/site rõ ràng, đồng bộ theme từ effective application theme.

### P2-08 — Production hardening và logging chưa đủ bằng chứng hoàn tất

**Bằng chứng:** chưa thấy CSP của chrome document tại HTML/server routes; startup `.catch` hiện show lỗi tổng quát rồi quit, không giữ chi tiết lỗi nguyên nhân ở đó. `OS_ACTIVITY_MODE=disable` trong preStart chỉ thay logging macOS, không chứng minh đã sửa lỗi input-context. [HTML](../assets/index.html), [routes](../routes/index.ts), [bootstrap](../app/main.ts), [Forge hook](../forge.config.ts).

**Đề xuất:** CSP production phù hợp local assets/inline startup theme; logging có redaction, mã lỗi bootstrap, crash recovery; phân biệt lọc log hệ điều hành với sửa lỗi. Audit không kết luận ứng dụng có XSS chỉ vì chưa thấy CSP.

### P2-09 — Restore/bounds và trạng thái đóng tab cần quyết định UX rõ

**Bằng chứng:** default window mới hiện là 1920×1080, minimum 1280×720; saved bounds kiểm tra còn nhìn thấy nhưng không clamp hoàn toàn vào work area. `closeTab` return khi chỉ còn một tab. [Window state](../main/windows/state.ts), [capital window](../main/windows/capital.ts), [Application](../app/index.tsx).

**Đề xuất:** test màn hình nhỏ/đổi monitor/scaling; xác định last-tab close là mở new-tab hay đóng window. Không mô tả default hiện tại là 1280×720 chỉ vì trước đây từng yêu cầu như vậy; HD/FHD là các menu action riêng.

## 7. Bảo vệ và persistence: giới hạn cần nói rõ

### 7.1. Blocker không tương đương bộ Shields của Brave

Gorth dùng Ghostery Full, có bundled engine để dùng khi offline, cache cập nhật atomic, exceptions theo hostname, custom filters, network/CSP/cosmetic/scriptlet integration và kiểm tra actual website/frame cho cosmetic IPC. Đây là triển khai thật, không chỉ một toggle UI. [Content blocker](../main/services/content-blocker.ts), [bundled-engine builder](../scripts/build-shields-engine.mjs).

Giới hạn hiện tại:

- Không phải Brave Rust engine; chưa có anti-fingerprinting, cookie partition policy hoặc HTTPS upgrade subsystem riêng.
- Không bảo đảm chặn hết YouTube ads hoặc mọi tracker bằng việc có EasyList/Ghostery.
- Counter là tổng runtime, chưa thấy thống kê riêng theo tab/site đầy đủ.
- Main-frame request được cho qua ở network matching hiện tại; extended cosmetic rules không bật trong `getCosmeticsFilters`.
- Khi thêm Profiles/Extensions/PDF hooks phải tổ chức một owner/composer cho từng `webRequest` event, tránh module này thay handler của module khác. Flow có unified webRequests để tham khảo, không nên copy trước khi cần.

Nguồn: [matching/injection Gorth](../main/services/content-blocker.ts), [Flow unified requests](../packages/flow-browser/src/main/controllers/sessions-controller/web-requests/index.ts).

### 7.2. Sleeping/archive không phải giữ nguyên bộ nhớ trang

Gorth bảo vệ active, pinned, grouped, internal, loading, audible, capture, download, media/PiP/pointer-lock/edited forms trước tự động sleep/archive. Sleeping lưu navigation, hủy view rồi tạo lại; archive lưu record trong DB và có UI restore/delete. Không thấy snapshot DOM, heap, scroll hoặc form state đầy đủ. Grouped/pinned tabs được bảo vệ cũng có nghĩa mở nhiều nhóm/pins vẫn có thể tốn RAM. [Lifecycle](../main/services/tab-lifecycle.ts), [Archive page](../pages/archive/index.tsx).

Flow cũng hủy/recreate view; comment ước tính RAM trong source không được dùng làm benchmark cho Gorth. Archive timer Flow dùng destroy, khác archive DB của Gorth. Cần so hành vi thực tế, không chỉ tên tính năng.

### 7.3. Database không phải encrypted vault

Dữ liệu nằm dưới Application Support/AppData/XDG config tại `Gorth/Browser`; macOS tương ứng `~/Library/Application Support/Gorth/Browser`. DB SQLite chứa browsing metadata dạng thông thường. Token SSO lưu ở `sso.v1.enc` bằng Electron safeStorage, từ chối Linux `basic_text`, ghi temporary file rồi rename. Cookie encryption fuse không mã hóa mọi bảng SQLite. [Data directory](../utils/data-directory.ts), [directory setup](../services/data-directory.ts), [vault](../lib/auth/vault.ts).

SSO account trong `user_profile` là cache danh tính. Chưa có nhiều profile session cho cookies/extensions/history, chưa có cloud synchronization. Không nên đổi nhãn trang account thành “browser profiles supported”.

## 8. Điểm Flow đáng học và những phần không nên sao chép nguyên trạng

### Nên học có chọn lọc

- Main-domain ownership cho tabs, profiles, spaces và mutation/persistence.
- Tách tab lifecycle, layout và bounds; có LayerManager và focus priority khi nhiều native surfaces.
- Session theo profile, có load deduplication và cleanup trên quit.
- Native Find có request correlation.
- Migration có version và đóng gói tài nguyên migration.
- Omnibox incremental suggestions với chống stale async result.
- Extensions tích hợp đầy đủ session/tab/window/popup/service worker; không chỉ `loadExtension`.
- OS URL queue để không đua với session restore lúc startup.
- Update controller có status/progress/install và UI tương ứng.

### Những hạn chế thấy ngay trong Flow snapshot

- Split model tồn tại nhưng nhánh split layout còn `TODO`; không đưa vào bảng “hoàn chỉnh”. [Split class](../packages/flow-browser/src/main/controllers/tabs-controller/tab-groups/split.ts), [tab layout](../packages/flow-browser/src/main/controllers/tabs-controller/tab-layout.ts).
- `GLANCE_ENABLED = false`; code model/layout tồn tại nhưng có feature gate. [Flags](../packages/flow-browser/src/main/modules/flags.ts).
- Permission handler cho phép phần lớn request ngoài external-app prompt. Không lấy đây làm mẫu default policy an toàn. [Permissions](../packages/flow-browser/src/main/controllers/sessions-controller/handlers/index.ts).
- Portal IPC callbacks trong file manager dùng `_event` mà không kiểm tra owner tại chính các callbacks đó. Cần rà toàn boundary trước khi áp dụng; không kết luận exploit từ việc đọc riêng file. [Portal manager](../packages/flow-browser/src/main/controllers/windows-controller/utils/browser/portal-component-windows.ts).
- Recently closed runtime-only có giới hạn 10, khác Gorth lưu DB; không thể tự xem là tốt hơn trên mọi tiêu chí.
- Unpacked extension uninstall còn `TODO`; Chrome extension integration không bảo đảm mọi Chrome API tương thích. [Extension manager](../packages/flow-browser/src/main/modules/extensions/management.ts).
- Flow có PostHog identify/events/error tracking; đây là quyết định privacy/product riêng, không cần thêm vào Gorth để đạt parity. [PostHog controller](../packages/flow-browser/src/main/controllers/posthog-controller/index.ts).
- Release config Windows có `verifyUpdateCodeSignature: false`; macOS có notarization config nhưng chưa test phát hành trong audit. Không sao chép mọi thiết lập release mặc định. [Builder](../packages/flow-browser/electron-builder.ts).
- `AGENTS.md` ghi chưa có automated test suites; Gorth hiện có nhiều unit/native test harness. Không đồng nghĩa test Gorth đã cover đủ UI hoặc security.
- Flow README và implementation lệch nhau ở pinned tabs/reorder; mã nguồn có giá trị cao hơn feature bullet cũ.

Flow README công bố GPL-3.0; metadata Gorth khai báo MIT. Khi lấy code/assets trực tiếp cần ghi rõ nguồn và rà yêu cầu license liên quan; báo cáo này không thực hiện sao chép mã Flow. [Flow README/license](../packages/flow-browser/README.md), [Gorth manifest](../package.json).

## 9. Lộ trình đề xuất

### Đợt A — Củng cố tính năng đang có

- Hoàn thiện permission policy/site data, nhất quán trusted sender/schema IPC.
- Chuẩn hóa migration, persistence failures và shutdown sequence.
- Đổi Find sang native, restore recently closed navigation/group/position.
- Thêm live invalidation shared history/bookmarks; quyết định setting scope.
- Regression tests portal/focus/theme/native layering và network recovery.

**Điều kiện hoàn thành:** view web không gọi được privileged app API; malformed payload không crash main; DB cũ upgrade được; Cmd+Shift+T giữ Back/Forward/group đúng; hai cửa sổ không mất dữ liệu; form chưa lưu có hành vi đóng rõ; popup không che lỗi bằng cách ẩn web content.

### Đợt B — Browser domain Profiles/Spaces

- Profile CRUD + session/storage isolation, không tái dùng SSO identity ID một cách mặc định.
- Spaces/workspace tab membership, ordering và active state theo window/space.
- Incognito có cleanup và không ghi history/persistent tab sessions vào profile thường.
- Drag reorder/move/pin với main-owned mutation và persistence.

**Điều kiện hoàn thành:** cookie/site data profile A không xuất hiện ở B; đóng incognito cuối không để lại tab/history trong DB thường; restart giữ membership/order; không có tab orphan khi xóa space.

### Đợt C — Extensions và navigation nâng cao

- Chrome Web Store-only theo định hướng đã yêu cầu: installation consent, metadata, enable/disable/uninstall, service workers và extension popup/lifecycle.
- Omnibox history/open-tabs/actions/remote suggestions, abort/stale guards và settings search engine thực tế.
- Cân nhắc PDF viewer, WebAuthn và Basic Auth prompt theo nhu cầu; không phải thêm tất cả package của Flow ngay.

**Điều kiện hoàn thành:** chưa xác nhận quyền thì không cài; restart phục hồi extension; website/extension không vượt app IPC boundary; untrusted manifest/path bị chặn; lỗi worker/popup không crash app; UI không hiển thị kết quả query cũ.

### Đợt D — Đưa đến bản phát hành dùng thường xuyên

- OS default-browser/open-url handling, queue startup URLs.
- Signing/notarization + auto-update có trạng thái, failure/retry và kiểm tra bản cập nhật.
- Production CSP, redacted diagnostics, crash/data recovery, backup/export/import.
- Lazy-load internal pages, đo cold start/RAM/CPU/tab-switch/portal latency trước tối ưu sâu.

**Điều kiện hoàn thành:** packaged app không phụ thuộc source/dev server, native SQLite chạy đúng ABI, assets/blocker/migrations đủ, URL từ OS chỉ tạo một cửa sổ/tab đúng; cập nhật không phá session; smoke tests macOS/Windows/Linux có kết quả thực tế.

## 10. Kiểm chứng trong lần audit này

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm exec tsc --noEmit --incremental false` | Pass. |
| `pnpm lint` | Pass, không có lỗi/warning trong output. |
| `pnpm test:rpc` | 4/4 pass: session/groups, internal routing, bounded request, trusted renderer URL. |
| `pnpm test:formatter` | 8/8 pass: architecture và display formatting. |
| `node scripts/test-shortcuts.mjs` | 5/5 pass: normalization/validation/conflicts/defaults/protected actions. |
| Bundle `tests/navigation.test.ts` bằng esbuild, chạy `node --test` | 6/6 pass: QUIC retry có giới hạn, cancellation và replacement safety. |
| Vite production renderer build, output `.vite/audit-verification/renderer` | Pass; 2.716 modules; JS 919,59 kB / gzip 283,62 kB; CSS 214,79 kB / gzip 32,02 kB. |
| `pnpm test:desktop-packages` | Không chạy được native suite: Electron import cố download binary, `fetch failed`, rồi báo Electron chưa cài đúng. |

Tổng **23 unit tests pass** trong các bộ kể trên. Test count không đo mức hoàn thiện chức năng hoặc tổng coverage toàn dự án.

Renderer build còn warning chunk > 500 kB. Đây là bundle output, không phải kết quả đo cold-start/render latency. Nhiều internal pages đang import eager từ `pages/index.tsx`; có cơ sở để ưu tiên route/page lazy loading trước khi chỉ tăng warning threshold.

Không xóa/cài lại dependency hoặc tải binary trong nhiệm vụ audit. Vì lỗi môi trường Electron nói trên, chưa xác nhận native startup, live Google/YouTube HTTP/3, DB/lifecycle/downloads trên Electron đang khai báo `44.6.0`, cũng chưa build/package main/preload trong lần này. Các harness native đang có là tài sản kiểm thử cần chạy lại khi môi trường sẵn sàng, không được ghi “đã pass” chỉ vì script tồn tại.

Các khu vực cần tăng coverage: permission checks/prompt, recently closed group/history, cross-window shared changes, beforeunload/quit, migration failures, portal rapid-hover/theme/fullscreen, extension worker và packaged artifacts. Không đăng nhập tài khoản SSO thật hoặc sử dụng database người dùng để kiểm thử.

## 11. Kết luận cuối

Gorth hiện có nhiều tính năng lõi thật và một số lựa chọn tốt hơn cho mục tiêu riêng: horizontal/vertical tabs, split thực tế, named normal groups, downloads manager, archive DB, SSO và test harness. Không cần viết lại theo Flow từ đầu.

Khoảng cách lớn nhất với Flow không nằm ở việc dùng shadcn hay số lượng dependency, mà ở **browser-domain ownership, Profiles/Spaces/session isolation, Extensions và omnibox/OS integration**. Trước các tính năng mới, cần hoàn thiện permission/data lifecycle và những hành vi đang có nhưng mới ở mức cơ bản. Flow là nguồn tham khảo hữu ích theo từng subsystem, không phải tiêu chuẩn an toàn/hoàn thiện mặc định.
