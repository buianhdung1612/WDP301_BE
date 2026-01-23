# 🎯 POSTMAN TEST WORKFLOW HOÀN CHỈNH

## ✅ Workflow: Từ duyệt dịch vụ → Đặt lịch → Hoàn thành

---

## 📌 **BƯỚC 1: Duyệt Danh Mục Dịch Vụ (CLIENT)**

### Request:
```
GET http://localhost:3000/api/v1/client/service-categories
```

### Response:
```json
{
  "code": 200,
  "message": "Danh sách danh mục dịch vụ",
  "data": [
    {
      "_id": "cat_id_1",
      "name": "Tắm Spa",
      "slug": "tam-spa"
    },
    {
      "_id": "cat_id_2",
      "name": "Khách sạn",
      "slug": "khach-san"
    }
  ]
}
```

**→ Lấy ID danh mục để dùng tiếp**

---

## 📌 **BƯỚC 2: Duyệt Dịch Vụ theo Danh Mục (CLIENT)**

### Request:
```
GET http://localhost:3000/api/v1/client/services?categoryId=cat_id_1&petType=dog
```

### Response:
```json
{
  "code": 200,
  "message": "Danh sách dịch vụ",
  "data": [
    {
      "_id": "service_id_1",
      "categoryId": "cat_id_1",
      "name": "Tắm spa chó",
      "duration": 60,
      "pricingType": "by-weight",
      "priceList": [
        {"label": "< 5kg", "value": 150000},
        {"label": "5-10kg", "value": 250000}
      ]
    }
  ]
}
```

**→ Lấy SERVICE_ID để tạo khung giờ**

---

## 📌 **BƯỚC 3: Admin - Tạo Khung Giờ (ADMIN)**

### Request:
```
POST http://localhost:3000/api/v1/admin/time-slots
```

### Body:
```json
{
  "serviceId": "service_id_1",
  "date": "2025-01-25T00:00:00Z",
  "startTime": "09:00",
  "endTime": "11:00",
  "maxCapacity": 2,
  "notes": "Khung giờ sáng thứ 7"
}
```

### Response:
```json
{
  "code": 201,
  "message": "Tạo khung giờ thành công",
  "data": {
    "_id": "slot_id_1",
    "serviceId": "service_id_1",
    "date": "2025-01-25T00:00:00Z",
    "startTime": "09:00",
    "endTime": "11:00",
    "maxCapacity": 2,
    "currentBookings": 0,
    "status": "available"
  }
}
```

**→ Lấy SLOT_ID để client đặt lịch**

---

## 📌 **BƯỚC 4: Client - Thêm Thú Cưng (CLIENT)**

### Request:
```
POST http://localhost:3000/api/v1/client/my-pets?userId=user123
```

### Body:
```json
{
  "name": "Bố",
  "type": "dog",
  "breed": "Poodle",
  "weight": 3.5,
  "age": 2,
  "color": "Nâu",
  "notes": "Hay sợ ồn"
}
```

### Response:
```json
{
  "code": 201,
  "message": "Thêm thú cưng thành công",
  "data": {
    "_id": "pet_id_1",
    "userId": "user123",
    "name": "Bố",
    "type": "dog",
    "weight": 3.5,
    "status": "active"
  }
}
```

**→ Lấy PET_ID để đặt lịch**

---

## 📌 **BƯỚC 5: Client - Đặt Lịch (CLIENT)**

### Request:
```
POST http://localhost:3000/api/v1/client/bookings?userId=user123
```

### Body:
```json
{
  "serviceId": "service_id_1",
  "slotId": "slot_id_1",
  "petIds": ["pet_id_1"],
  "customerName": "Nguyễn Văn A",
  "customerPhone": "0912345678",
  "customerEmail": "customer@example.com",
  "notes": "Vui lòng cẩn thận, chó sợ ồn"
}
```

### Response:
```json
{
  "code": 201,
  "message": "Tạo lịch đặt thành công",
  "data": {
    "_id": "booking_id_1",
    "bookingCode": "BK1705916400000",
    "userId": "user123",
    "serviceId": "service_id_1",
    "slotId": "slot_id_1",
    "petIds": ["pet_id_1"],
    "status": "pending",
    "totalPrice": 150000,
    "paymentStatus": "unpaid"
  }
}
```

**→ Lưu BOOKING_ID**

---

## 📌 **BƯỚC 6: Client - Xem Danh Sách Lịch Đặt (CLIENT)**

### Request:
```
GET http://localhost:3000/api/v1/client/bookings?userId=user123&status=pending
```

### Response:
```json
{
  "code": 200,
  "message": "Danh sách lịch đặt của tôi",
  "data": [
    {
      "_id": "booking_id_1",
      "bookingCode": "BK1705916400000",
      "status": "pending",
      "totalPrice": 150000
    }
  ]
}
```

---

## 📌 **BƯỚC 7: Admin - Xác Nhận Lịch Đặt (ADMIN)**

### Request:
```
PATCH http://localhost:3000/api/v1/admin/bookings/booking_id_1/confirm
```

### Body:
```json
{}
```

### Response:
```json
{
  "code": 200,
  "message": "Xác nhận lịch đặt thành công",
  "data": {
    "_id": "booking_id_1",
    "status": "confirmed"
  }
}
```

---

## 📌 **BƯỚC 8: Admin - Hoàn Thành Lịch Đặt (ADMIN)**

### Request:
```
PATCH http://localhost:3000/api/v1/admin/bookings/booking_id_1/complete
```

### Body:
```json
{}
```

### Response:
```json
{
  "code": 200,
  "message": "Hoàn thành lịch đặt thành công",
  "data": {
    "_id": "booking_id_1",
    "status": "completed",
    "completedAt": "2025-01-24T10:30:00Z"
  }
}
```

---

## 📌 **BƯỚC 9 (Tùy chọn): Client - Hủy Lịch (CLIENT)**

### Request:
```
PATCH http://localhost:3000/api/v1/client/bookings/booking_id_1/cancel?userId=user123
```

### Body:
```json
{
  "reason": "Thay đổi lịch"
}
```

### Response:
```json
{
  "code": 200,
  "message": "Hủy lịch đặt thành công",
  "data": {
    "_id": "booking_id_1",
    "status": "cancelled",
    "cancelledReason": "Thay đổi lịch"
  }
}
```

---

## 📌 **BƯỚC 10 (Tùy chọn): Admin - Hủy Lịch (ADMIN)**

### Request:
```
PATCH http://localhost:3000/api/v1/admin/bookings/booking_id_1/cancel
```

### Body:
```json
{
  "reason": "Khách hàng yêu cầu"
}
```

---

## 🧪 **TEST CASES KHÁC**

### 1️⃣ Test Lỗi Validation

**Tạo service thiếu field:**
```
POST /api/v1/admin/services
{
  "name": "Dịch vụ test"
  // Thiếu categoryId, slug, duration, petType
}
```

**Expected:** 400 Bad Request

---

### 2️⃣ Test Duplicate Booking (Slot đầy)

**Tạo 2 bookings cùng slot (capacity = 2):**
```
POST /api/v1/client/bookings?userId=user123
{
  "serviceId": "service_id_1",
  "slotId": "slot_id_1",
  "petIds": ["pet_id_1", "pet_id_2"],
  ...
}
```

**Booking 1:** ✅ Thành công (currentBookings = 2, status = full)
**Booking 2:** ❌ 400 "Khung giờ này đã đầy"

---

### 3️⃣ Test Khách Sạn (Boarding)

**Tạo booking khách sạn:**
```
POST /api/v1/client/bookings?userId=user123
{
  "serviceId": "service_khach_san_m",
  "slotId": "slot_khach_san",
  "petIds": ["pet_id_1"],
  "customerName": "A",
  "customerPhone": "0912345678",
  "customerEmail": "a@test.com"
}
```

---

### 4️⃣ Test Vận Chuyển

**Tạo booking vận chuyển:**
```
POST /api/v1/client/bookings?userId=user123
{
  "serviceId": "service_van_chuyen",
  "slotId": "slot_van_chuyen",
  "petIds": ["pet_id_1"],
  ...
}
```

---

## 📊 **TÓNG HỢP QUERY PARAMS**

| Endpoint | Query Params | Mục đích |
|----------|-------------|---------|
| `/client/services` | `categoryId`, `petType`, `page`, `limit` | Filter dịch vụ |
| `/client/bookings` | `userId`, `status`, `page`, `limit` | Filter lịch đặt |
| `/client/my-pets` | `userId` | Lấy thú cưng (có hoặc không) |
| `/admin/services` | `page`, `limit` | Danh sách dịch vụ |
| `/admin/bookings` | `status`, `page`, `limit` | Filter lịch đặt |
| `/admin/time-slots` | `serviceId`, `date`, `page`, `limit` | Filter khung giờ |

---

## 💾 **LƯU ID VÀO POSTMAN ENVIRONMENT**

**Trong tab Tests, thêm script:**
```javascript
if (pm.response.code === 200 || pm.response.code === 201) {
    var jsonData = pm.response.json();
    if (jsonData.data) {
        // Lưu ID
        if (jsonData.data._id) {
            pm.environment.set("last_id", jsonData.data._id);
        }
        // Lưu booking code
        if (jsonData.data.bookingCode) {
            pm.environment.set("booking_code", jsonData.data.bookingCode);
        }
    }
}
```

Sau đó dùng trong requests: `{{last_id}}`

---

## ✅ **CHECKLIST TEST HOÀN CHỈNH**

- [ ] Duyệt danh mục dịch vụ
- [ ] Duyệt dịch vụ theo danh mục
- [ ] Tạo khung giờ
- [ ] Thêm thú cưng
- [ ] Đặt lịch 1 pet
- [ ] Đặt lịch 2 pets
- [ ] Xác nhận lịch
- [ ] Hoàn thành lịch
- [ ] Hủy lịch (client)
- [ ] Hủy lịch (admin)
- [ ] Test validation errors
- [ ] Test slot full

---

Bắt đầu test nào! 🚀
