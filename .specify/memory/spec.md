# Feature Specification: Predict Strategy Copilot

**Feature Branch**: `predict-strategy-copilot`
**Created**: 2026-06-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Kết nối ví & khởi tạo tài khoản chơi (Priority: P1)

Người dùng mở ứng dụng, kết nối ví Sui, và hệ thống tự động phát hiện hoặc tạo tài khoản chơi (game account) mà không yêu cầu người dùng hiểu khái niệm này. **Số dư khả dụng được hiển thị là số dư DUSDC bên trong tài khoản chơi** (không phải số dư ví), vì lệnh vào sẽ trừ tiền từ tài khoản chơi.

**Why this priority**: Đây là điểm vào bắt buộc của toàn bộ luồng; không có bước này thì không thể làm gì khác.

**Independent Test**: Kết nối ví testnet → kiểm tra số dư hiển thị đúng và tài khoản chơi được tạo/phát hiện tự động.

**Acceptance Scenarios**:

1. **Given** ví chưa kết nối, **When** người dùng bấm "Kết nối ví", **Then** ứng dụng yêu cầu phê duyệt qua ví và hiển thị số dư DUSDC trong tài khoản chơi sau khi chấp nhận.
2. **Given** ví đã kết nối nhưng chưa có tài khoản chơi, **When** hệ thống khởi tạo, **Then** tài khoản chơi được tạo tự động (giao dịch thật trên testnet) mà không yêu cầu bất kỳ thao tác thủ công nào từ người dùng.
3. **Given** ví đã kết nối và tài khoản chơi tồn tại, **When** người dùng quay lại ứng dụng, **Then** số dư DUSDC trong tài khoản chơi và thông tin tài khoản được phục hồi đúng mà không tạo lại.
4. **Given** tài khoản chơi có số dư DUSDC = 0 nhưng ví vẫn còn DUSDC, **When** người dùng xem màn hình chính, **Then** hệ thống hiển thị tùy chọn nạp tiền từ ví vào tài khoản chơi.

---

### User Story 2 — Xem danh sách chiến lược gợi ý (Priority: P1)

Người dùng nhập số tiền đặt cược và chọn khung kỳ hạn (15 phút / 30 phút / 1 giờ). Hệ thống tự động đọc giá BTC hiện tại và biến động thị trường, tính toán và hiển thị 2–3 chiến lược bằng ngôn ngữ thường trong vòng 3 giây.

**Why this priority**: Đây là tính năng cốt lõi tạo ra giá trị khác biệt của sản phẩm — loại bỏ rào cản kiến thức cho người dùng phổ thông.

**Independent Test**: Nhập số tiền + chọn kỳ hạn → danh sách chiến lược hiển thị với đủ 4 thông tin (mô tả, chi phí, tiền thắng, xác suất, countdown).

**Acceptance Scenarios**:

1. **Given** ví đã kết nối và có thị trường đang mở cho kỳ hạn đã chọn, **When** người dùng nhập số tiền và chọn kỳ hạn, **Then** hệ thống hiển thị 2–3 chiến lược trong ≤ 3 giây, mỗi chiến lược gồm: mô tả một câu (ngôn ngữ thường), chi phí, tiền thắng tối đa, xác suất thắng ước lượng (%), đồng hồ đếm ngược.
2. **Given** biến động thị trường thay đổi, **When** chiến lược được tính, **Then** mức giá/khoảng giá trong chiến lược phản ánh dữ liệu thực tế (không dùng giá trị cố định).
3. **Given** không có thị trường nào đang mở cho khung kỳ hạn đã chọn, **When** người dùng chọn kỳ hạn đó, **Then** hệ thống hiển thị thông báo rõ ràng bằng ngôn ngữ thường và không hiển thị chiến lược hay lỗi kỹ thuật.
4. **Given** dữ liệu biến động đã cũ hơn 30 giây, **When** hệ thống kiểm tra, **Then** hiển thị cảnh báo bằng ngôn ngữ thường và chặn vào lệnh cho đến khi dữ liệu được làm mới.

---

### User Story 3 — Vào lệnh và ký giao dịch (Priority: P1)

Người dùng chọn một chiến lược và xác nhận. Hệ thống gửi giao dịch thật lên testnet DeepBook Predict, hiển thị trạng thái xử lý, và xử lý tất cả kết quả (thành công / thất bại / người dùng từ chối ký).

**Why this priority**: Đây là hành động tạo ra giá trị thực — không có bước này thì toàn bộ luồng không hoàn chỉnh.

**Independent Test**: Chọn chiến lược → ký → giao dịch được submit lên testnet → trạng thái vị thế chuyển sang "Đang hoạt động".

**Acceptance Scenarios**:

1. **Given** người dùng đã chọn chiến lược, **When** bấm xác nhận và ký qua ví, **Then** giao dịch được submit lên testnet và vị thế chuyển sang trạng thái "Đang hoạt động".
2. **Given** người dùng từ chối ký trong ví, **When** từ chối được nhận về, **Then** hệ thống hiển thị thông báo thân thiện và đưa người dùng quay lại màn chọn chiến lược; ứng dụng không treo.
3. **Given** giao dịch thất bại do lỗi mạng hoặc protocol, **When** lỗi nhận về, **Then** hệ thống báo lý do bằng ngôn ngữ thường và đưa người dùng quay lại bước chọn chiến lược.
4. **Given** số dư không đủ, **When** người dùng cố xác nhận, **Then** hệ thống chặn và hiển thị thông báo trước khi gửi giao dịch.

---

### User Story 4 — Theo dõi vị thế đang mở (Priority: P2)

Sau khi vào lệnh thành công, người dùng theo dõi vị thế: lời/lỗ tạm tính và đồng hồ đếm ngược tới thời điểm chốt kết quả.

**Why this priority**: Tăng sự tham gia và tin tưởng của người dùng; không bắt buộc để MVP chạy được nhưng là phần của luồng hoàn chỉnh.

**Independent Test**: Vào lệnh thành công → màn theo dõi hiển thị đúng trạng thái, P&L, và countdown.

**Acceptance Scenarios**:

1. **Given** vị thế đang hoạt động, **When** người dùng xem màn theo dõi, **Then** hiển thị: trạng thái "Đang hoạt động", P&L tạm tính, đồng hồ đếm ngược đến khi chốt.
2. **Given** thị trường đã chốt kết quả, **When** vị thế được cập nhật, **Then** trạng thái chuyển sang "Đã chốt – Thắng" hoặc "Đã chốt – Thua" đúng với kết quả thực.

---

### User Story 5 — Nhận thưởng khi thắng (Priority: P2)

Khi thị trường chốt và người dùng thắng, hệ thống hiển thị tùy chọn nhận thưởng. Người dùng bấm một nút để nhận tiền về tài khoản chơi (giao dịch thật).

**Why this priority**: Hoàn thiện vòng lặp giá trị; chỉ chủ sở hữu tài khoản mới có thể nhận thưởng.

**Independent Test**: Vị thế thắng → bấm "Nhận thưởng" → ký giao dịch → số dư tăng đúng.

**Acceptance Scenarios**:

1. **Given** vị thế ở trạng thái "Đã chốt – Thắng", **When** người dùng bấm "Nhận thưởng" và ký qua ví, **Then** tiền thưởng được chuyển về tài khoản chơi và trạng thái vị thế chuyển sang "Đã nhận thưởng".
2. **Given** vị thế ở trạng thái "Đã chốt – Thua", **When** người dùng xem vị thế, **Then** hệ thống hiển thị "Lần này không trúng" và gợi ý xem chiến lược cho kỳ hạn mới.
3. **Given** ví khác (không phải chủ sở hữu tài khoản chơi), **When** cố nhận thưởng, **Then** giao dịch bị từ chối. *(Ghi chú thiết kế: MVP áp dụng cơ chế owner-only redeem. Protocol thực tế hỗ trợ cả cơ chế bất kỳ ai trigger nhận hộ — tiền vẫn về đúng chủ — nhưng đó là lựa chọn nằm ngoài phạm vi v1.)*

---

### Edge Cases

- Điều gì xảy ra khi kết nối mạng bị mất giữa chừng lúc submit giao dịch?
- Điều gì xảy ra khi giá BTC thay đổi mạnh sau khi chiến lược đã hiển thị nhưng trước khi người dùng xác nhận?
- Điều gì xảy ra khi mức giá tính ra từ ±1σ không nằm trong tập mức hợp lệ của protocol?
- Điều gì xảy ra khi người dùng có nhiều vị thế đang mở đồng thời trên nhiều kỳ hạn?
- Điều gì xảy ra khi số dư tài khoản chơi = 0 nhưng ví vẫn còn DUSDC — người dùng cần nạp tiền trước khi vào lệnh?
- Điều gì xảy ra khi cả số dư tài khoản chơi lẫn số dư ví đều = 0?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI tích hợp trực tiếp với DeepBook Predict trên testnet Sui; mọi lệnh vào và nhận thưởng đều là giao dịch thật.
- **FR-002**: Hệ thống PHẢI tự phát hiện tài khoản chơi; nếu chưa có thì tự tạo mà không yêu cầu người dùng thao tác thủ công.
- **FR-003**: Hệ thống PHẢI tính chiến lược từ dữ liệu biến động thực tế của thị trường tại thời điểm hiển thị; không dùng giá trị cố định.
- **FR-004**: Hệ thống PHẢI áp dụng đúng 3 quy tắc định lượng: "Đặt giá đứng yên" = ±1σ quanh giá hiện tại; "Đặt giá lên" = nhị phân hướng lên quanh giá hiện tại; "Phòng cú sập" = nhị phân tại −2σ.
- **FR-005**: Hệ thống PHẢI làm tròn mức giá tính ra về mức hợp lệ gần nhất trong tập mức được protocol chấp nhận; nếu không tìm được mức hợp lệ thì không cho vào lệnh.
- **FR-006**: Hệ thống PHẢI kiểm tra đồng thời 3 điều kiện trước khi vào lệnh: (a) số tiền > 0 và ≤ số dư DUSDC trong tài khoản chơi, (b) có thị trường đang mở cho khung đã chọn, (c) dữ liệu biến động không cũ hơn 30 giây tính từ thời điểm fetch gần nhất.
- **FR-007**: Hệ thống PHẢI hiển thị trạng thái vị thế theo đúng vòng đời: Đang hoạt động → Chờ chốt → Đã chốt (Thắng/Thua) → Đã nhận thưởng.
- **FR-008**: Hệ thống PHẢI KHÔNG lưu khóa riêng của người dùng; mọi giao dịch phải được ký qua ví của người dùng.
- **FR-009**: Giao diện PHẢI dùng ngôn ngữ thường; không phơi bày thuật ngữ chuyên ngành (strike price, implied volatility, vol curve) cho người dùng phổ thông.
- **FR-010**: Mọi số tiền hiển thị PHẢI đúng đơn vị **DUSDC (DeepBook Test USDC)** — token riêng của protocol DeepBook Predict, không phải USDC testnet chính thức và không phải SUI — và không có sai số thập phân.
- **FR-011**: Hệ thống PHẢI xử lý tất cả kết quả giao dịch: thành công, thất bại, và người dùng từ chối ký — không tình huống nào làm ứng dụng treo.
- **FR-012**: MVP áp dụng cơ chế owner-only redeem: chỉ chủ sở hữu tài khoản chơi mới được tự nhận thưởng về tài khoản của mình.
- **FR-013**: Hệ thống PHẢI hỗ trợ hành vi nạp tiền từ ví vào tài khoản chơi (deposit): người dùng xác nhận số tiền DUSDC muốn nạp, ký giao dịch, và số dư tài khoản chơi được cập nhật sau khi giao dịch thành công. Đây là bước bắt buộc trước khi có thể vào lệnh lần đầu.

### Key Entities

- **Tài khoản chơi (Game Account)**: Đại diện cho tài khoản on-chain của người dùng trên DeepBook Predict; liên kết 1-1 với địa chỉ ví; chứa số dư DUSDC khả dụng để đặt cược. Tiền phải được nạp từ ví vào tài khoản chơi trước khi vào lệnh.
- **Thị trường (Market)**: Một kỳ hạn cụ thể đang mở trên protocol (15 phút / 30 phút / 1 giờ); có trạng thái mở/đóng, giá tham chiếu, biến động, tập mức giá hợp lệ.
- **Chiến lược (Strategy)**: Một đề xuất được tính toán từ dữ liệu thị trường; có loại (range / binary-up / binary-down), mức giá/khoảng giá, chi phí, tiền thắng, xác suất, countdown.
- **Vị thế (Position)**: Một lệnh đã vào thành công; có trạng thái, loại cược, mức giá, số tiền đặt, P&L tạm tính.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng mới hoàn thành trọn vòng (kết nối ví → chọn chiến lược → vào lệnh → nhận thưởng) trong dưới 5 phút mà không cần đọc hướng dẫn bên ngoài.
- **SC-002**: Từ lúc người dùng yêu cầu xem chiến lược đến khi danh sách hiển thị: ≤ 3 giây với dữ liệu thị trường sẵn có.
- **SC-003**: 100% mức giá và khoảng giá được đặt lệnh là hợp lệ với protocol; không có giao dịch nào thất bại do mức giá không hợp lệ.
- **SC-004**: Hệ thống chạy được trọn vẹn đầu-cuối trên testnet: tối thiểu 1 lệnh nhị phân và 1 lệnh khoảng được vào và nhận thưởng thành công.
- **SC-005**: Hệ thống xử lý đúng cả 3 tình huống — thắng, thua, người dùng từ chối ký — không tình huống nào làm ứng dụng treo hoặc hiển thị sai trạng thái.
- **SC-006**: Trong 100% trường hợp không có thị trường mở cho khung đã chọn, hệ thống báo rõ ràng bằng ngôn ngữ thường và không hiển thị chiến lược rỗng hay lỗi kỹ thuật.

## Assumptions

- Ứng dụng chạy trên môi trường testnet Sui; không có tiền thật liên quan.
- Chỉ có một actor duy nhất: người chơi phổ thông. Không có vai trò admin hay moderator.
- Protocol DeepBook Predict, oracle giá, và cơ chế chốt kết quả do bên thứ ba vận hành — nằm ngoài phạm vi hệ thống này.
- Người dùng đã có ví Sui tương thích (Suiet, Sui Wallet, v.v.) được cài đặt sẵn trên trình duyệt.
- Dữ liệu biến động được đọc trực tiếp từ trạng thái on-chain của thị trường tại thời điểm hiển thị.
- Mobile support nằm ngoài phạm vi v1; ứng dụng chạy trên desktop browser.
- Số tiền đặt cược và số dư tài khoản chơi tính theo đơn vị **DUSDC (DeepBook Test USDC)** — token riêng của DeepBook Predict, phân biệt với USDC testnet chính thức. Người dùng phải xin DUSDC qua faucet riêng của hackathon trước khi chơi.
