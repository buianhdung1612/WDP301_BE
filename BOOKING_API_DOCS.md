# PET SHOP BOOKING SYSTEM - API DOCUMENTATION

## 📋 DATABASE MODELS

- `service-category.model.ts` - Danh mục dịch vụ
- `service.model.ts` - Chi tiết dịch vụ + Bảng giá
- `pet.model.ts` - Thông tin thú cưng
- `time-slot.model.ts` - Khung giờ làm việc
- `booking.model.ts` - Lịch đặt
- `staff.model.ts` - Nhân viên
- `booking-review.model.ts` - Đánh giá lịch đặt
- `transport-service.model.ts` - Dịch vụ vận chuyển
- `boarding-cage.model.ts` - Chuồng/phòng khách sạn
- `boarding-booking.model.ts` - Lịch lưu trú
- `promotion.model.ts` - Khuyến mãi & Coupon

---

## 🔗 ADMIN ROUTES - `/api/v1/admin/`

### Services Management
```
GET    /services              - Danh sách dịch vụ
GET    /services/:id          - Chi tiết dịch vụ
POST   /services              - Tạo dịch vụ
PATCH  /services/:id          - Cập nhật dịch vụ
DELETE /services/:id          - Xóa dịch vụ
```
{
  "name": "Cắt tia lông",
  "slug": "cat-tia-long",
  "description": "Dịch vụ cắt lông chó mèo",
  "icon": "scissors"
}
### Bookings Management
```
GET    /bookings              - Danh sách lịch đặt
GET    /bookings/:id          - Chi tiết lịch đặt
PATCH  /bookings/:id/confirm  - Xác nhận lịch đặt
PATCH  /bookings/:id/cancel   - Hủy lịch đặt
PATCH  /bookings/:id/complete - Hoàn thành lịch đặt
```

### Pets Management
```
GET    /pets                  - Danh sách thú cưng
GET    /pets/:id              - Chi tiết thú cưng
PATCH  /pets/:id              - Cập nhật thú cưng
DELETE /pets/:id              - Xóa thú cưng
```

### Time Slots Management
```
GET    /time-slots            - Danh sách khung giờ
POST   /time-slots            - Tạo khung giờ
PATCH  /time-slots/:id        - Cập nhật khung giờ
DELETE /time-slots/:id        - Xóa khung giờ
```

---

## 🔗 CLIENT ROUTES - `/api/v1/client/`

### Services (Browse)
```
GET    /services              - Danh sách dịch vụ (active)
GET    /services/:id          - Chi tiết dịch vụ
GET    /service-categories    - Danh mục dịch vụ
```

### Bookings
```
GET    /bookings              - Danh sách lịch đặt của tôi
GET    /bookings/:id          - Chi tiết lịch đặt
POST   /bookings              - Tạo lịch đặt
PATCH  /bookings/:id/cancel   - Hủy lịch đặt
```

### My Pets
```
GET    /my-pets               - Danh sách thú cưng của tôi
GET    /my-pets/:id           - Chi tiết thú cưng
POST   /my-pets               - Thêm thú cưng
PATCH  /my-pets/:id           - Cập nhật thú cưng
DELETE /my-pets/:id           - Xóa thú cưng
```

---

## ✅ VALIDATION SCHEMAS

### Service Validation
- `createServiceSchema` - Tạo dịch vụ
- `updateServiceSchema` - Cập nhật dịch vụ

### Booking Validation
- `createBookingSchema` - Tạo lịch đặt
- `cancelBookingSchema` - Hủy lịch đặt

### Pet Validation
- `createPetSchema` - Thêm thú cưng
- `updatePetSchema` - Cập nhật thú cưng

### Time Slot Validation
- `createTimeSlotSchema` - Tạo khung giờ
- `updateTimeSlotSchema` - Cập nhật khung giờ

---

## 🎯 KEY FEATURES

✔️ Quản lý dịch vụ đa dạng (grooming, tắm, khách sạn, vận chuyển, tư vấn)
✔️ Tính giá linh hoạt (cố định, theo cân nặng, theo loại chuồng, theo km)
✔️ Quản lý khung giờ + sức chứa
✔️ Booking grooming & dịch vụ khác
✔️ Quản lý thú cưng khách hàng
✔️ Đánh giá & review
✔️ Khuyến mãi & coupon
✔️ Soft delete (xóa mềm)
✔️ Pagination & filtering
✔️ Status tracking

---

## 📝 NEXT STEPS

1. Integrate validation middleware in routes
2. Add authentication middleware (JWT)
3. Create boarding cage & boarding booking controllers
4. Create staff management controllers
5. Create review controllers
6. Add error handling middleware
7. Add logging & monitoring
