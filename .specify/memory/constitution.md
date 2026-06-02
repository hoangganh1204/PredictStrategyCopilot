# PredictStrategyCopilot Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)
- Tuân thủ Clean Code; mọi hàm không được vượt quá 30 dòng
- Đặt tên theo convention: `camelCase` cho biến/hàm, `PascalCase` cho class/type/component
- Không dùng magic number — mọi giá trị cứng phải được đưa vào hằng số có tên rõ ràng
- Mọi PR phải được review và đạt lint/format check trước khi merge

### II. Testing (NON-NEGOTIABLE)
- Mọi business logic phải có unit test
- Coverage tối thiểu **80%** cho service layer
- Integration test bắt buộc cho mọi API endpoint
- Tuân theo chu kỳ Red → Green → Refactor (TDD)

### III. UX Consistency
- Dùng design system của công ty (tham chiếu Figma) — không tự tạo component UI ngoài hệ thống
- Mọi form phải có validation hiển thị rõ ràng (inline error message)
- Bất kỳ tác vụ nào mất hơn **300ms** phải có loading state

### IV. Performance
- API response time < **500ms** cho 95% request trong điều kiện production
- Không để xảy ra N+1 query trong database access — dùng eager loading hoặc batch query
- Profiling bắt buộc khi thêm query mới vào flow quan trọng

### V. Security
- Dùng `@company/auth` cho toàn bộ authentication — không tự implement auth logic
- Không log dữ liệu cá nhân: số CCCD, số thẻ, mật khẩu, token
- Mọi input từ client phải được validate và sanitize ở server

## Quality Gates

| Gate | Requirement |
|------|-------------|
| Unit test coverage | ≥ 80% trên service layer |
| Function length | ≤ 30 dòng |
| API response (p95) | < 500ms |
| Loading state | Bắt buộc nếu tác vụ > 300ms |
| Auth implementation | Chỉ dùng `@company/auth` |

## Governance

- **Khi có xung đột giữa performance và code quality**: ưu tiên code quality, trừ khi performance ảnh hưởng trực tiếp đến UX người dùng cuối.
- Mọi quyết định vi phạm nguyên tắc trên phải được ghi chú rõ lý do kỹ thuật trong spec/PR description.
- Constitution này có quyền ưu tiên cao hơn mọi convention cục bộ khác.
- Mọi amendment phải có tài liệu, được approve bởi tech lead, và có migration plan nếu cần.

**Version**: 1.0.0 | **Ratified**: 2026-06-02 | **Last Amended**: 2026-06-02
