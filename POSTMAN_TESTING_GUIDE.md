# 📬 HƯỚNG DẪN TEST API BẰNG POSTMAN

## 1️⃣ CÀI ĐẶT POSTMAN

**Bước 1:** Tải Postman từ https://www.postman.com/downloads/
**Bước 2:** Cài đặt và tạo tài khoản (hoặc dùng offline)
**Bước 3:** Mở Postman

---

## 2️⃣ IMPORT COLLECTION

### Cách 1: Import file JSON
1. Click vào nút **Import** (góc trái)
2. Chọn **File** → chọn file `Postman_Collection.json`
3. Click **Import**

### Cách 2: Copy-Paste link (nếu có)
1. Click **Import** → **Link**
2. Paste URL của collection

---

## 3️⃣ CẤU HÌNH ENVIRONMENT (Tùy chọn)

### Tạo biến môi trường
1. Click vào nút **Environment** (góc phải)
2. Click **Create New** hoặc **+**
3. Đặt tên: `Pet Shop Dev`
4. Thêm các biến:

```
VARIABLE              VALUE
------                -----
base_url             http://localhost:3000/api/v1
admin_base_url       http://localhost:3000/api/v1/admin
client_base_url      http://localhost:3000/api/v1/client
user_id              [USER_ID_CỦA_BẠN]
category_id          [CATEGORY_ID]
service_id           [SERVICE_ID]
slot_id              [SLOT_ID]
booking_id           [BOOKING_ID]
pet_id               [PET_ID]
staff_id             [STAFF_ID]
```

Sau đó sử dụng trong requests: `{{base_url}}/services`

---

## 4️⃣ QUY TRÌNH TEST CHI TIẾT

### **BƯỚC 1: TẠO DANH MỤC DỊCH VỤ**

Lưu ý: Cần có dữ liệu `ServiceCategory` trước

Nếu chưa có, bạn có thể:
- Trực tiếp insert vào MongoDB: 
```javascript
db.services-category.insertOne({
  name: "Cắt tia lông",
  slug: "cat-tia-long",
  description: "Dịch vụ cắt lông chó mèo",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date()
})
```

Lấy ID: `656b1c2d8f4c2a001a2b3c4d`

---

### **BƯỚC 2: TẠO DỊCH VỤ (ADMIN)**

```
POST /api/v1/admin/services
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "categoryId": "656b1c2d8f4c2a001a2b3c4d",
  "name": "Tắm spa chó",
  "slug": "tam-spa-cho",
  "description": "Dịch vụ tắm spa toàn diện cho chó",
  "duration": 60,
  "petType": ["dog"],
  "pricingType": "by-weight",
  "priceList": [
    {"label": "< 5kg", "value": 150000},
    {"label": "5-10kg", "value": 250000},
    {"label": "10-20kg", "value": 350000},
    {"label": "> 20kg", "value": 500000}
  ]
}
```

**Kết quả:** Lấy `_id` của service vừa tạo

---

### **BƯỚC 3: TẠO KHUNG GIỜ (ADMIN)**

```
POST /api/v1/admin/time-slots
```

**Body:**
```json
{
  "serviceId": "[SERVICE_ID_VỪA_TẠO]",
  "date": "2025-01-25T00:00:00Z",
  "startTime": "09:00",
  "endTime": "11:00",
  "maxCapacity": 2,
  "staffId": "[CÓ_HOẶC_KHÔNG]",
  "notes": "Khung giờ sáng thứ 2"
}
```

**Kết quả:** Lấy `_id` của slot vừa tạo

---

### **BƯỚC 4: THÊM THƯỚC CƯNG (CLIENT)**

```
POST /api/v1/client/my-pets
```

**Body:**
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

**Kết quả:** Lấy `_id` của pet vừa tạo

---

### **BƯỚC 5: ĐẶT LỊCH (CLIENT)**

```
POST /api/v1/client/bookings
```

**Body:**
```json
{
  "serviceId": "[SERVICE_ID]",
  "slotId": "[SLOT_ID]",
  "petIds": ["[PET_ID]"],
  "customerName": "Nguyễn Văn A",
  "customerPhone": "0912345678",
  "customerEmail": "customer@example.com",
  "notes": "Vui lòng cẩn thận, thú cưng sợ ồn"
}
```

**Kết quả:** Lấy `bookingCode` và `_id`

---

### **BƯỚC 6: XÁC NHẬN LỊCH ĐẶT (ADMIN)**

```
PATCH /api/v1/admin/bookings/[BOOKING_ID]/confirm
```

**Body:**
```json
{}
```

---

### **BƯỚC 7: HOÀN THÀNH LỊCH ĐẶT (ADMIN)**

```
PATCH /api/v1/admin/bookings/[BOOKING_ID]/complete
```

**Body:**
```json
{}
```

---

## 5️⃣ DANH SÁCH TẤT CẢ ENDPOINTS

### 📍 ADMIN - Services
```
GET    /admin/services           - Danh sách dịch vụ
POST   /admin/services           - Tạo dịch vụ
GET    /admin/services/:id       - Chi tiết dịch vụ
PATCH  /admin/services/:id       - Cập nhật dịch vụ
DELETE /admin/services/:id       - Xóa dịch vụ
```

### 📍 ADMIN - Time Slots
```
GET    /admin/time-slots         - Danh sách khung giờ
POST   /admin/time-slots         - Tạo khung giờ
PATCH  /admin/time-slots/:id     - Cập nhật khung giờ
DELETE /admin/time-slots/:id     - Xóa khung giờ
```

### 📍 ADMIN - Bookings
```
GET    /admin/bookings           - Danh sách lịch đặt
GET    /admin/bookings/:id       - Chi tiết lịch đặt
PATCH  /admin/bookings/:id/confirm   - Xác nhận
PATCH  /admin/bookings/:id/cancel    - Hủy
PATCH  /admin/bookings/:id/complete  - Hoàn thành
```

### 📍 ADMIN - Pets
```
GET    /admin/pets               - Danh sách thú cưng
GET    /admin/pets/:id           - Chi tiết thú cưng
PATCH  /admin/pets/:id           - Cập nhật thú cưng
DELETE /admin/pets/:id           - Xóa thú cưng
```

### 📍 CLIENT - Services (Browse)
```
GET    /client/services          - Danh sách dịch vụ
GET    /client/services/:id      - Chi tiết dịch vụ
GET    /client/service-categories - Danh mục dịch vụ
```

### 📍 CLIENT - My Pets
```
GET    /client/my-pets           - Danh sách thú cưng của tôi
POST   /client/my-pets           - Thêm thú cưng
GET    /client/my-pets/:id       - Chi tiết thú cưng
PATCH  /client/my-pets/:id       - Cập nhật thú cưng
DELETE /client/my-pets/:id       - Xóa thú cưng
```

### 📍 CLIENT - Bookings
```
GET    /client/bookings          - Danh sách lịch đặt của tôi
POST   /client/bookings          - Tạo lịch đặt
GET    /client/bookings/:id      - Chi tiết lịch đặt
PATCH  /client/bookings/:id/cancel - Hủy lịch đặt
```

---

## 6️⃣ TEST RESPONSE HANDLING

### Response thành công (200/201):
```json
{
  "code": 200,
  "message": "Thành công",
  "data": { ... },
  "pagination": { ... }
}
```

### Response lỗi (400/404/500):
```json
{
  "code": 400,
  "message": "Lỗi validation",
  "error": "..."
}
```

---

## 7️⃣ TIPS & TRICKS

✅ **Lưu ID vào biến môi trường:**
- Click tab **Tests** trong request
- Thêm script:
```javascript
if (pm.response.code === 201 || pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("service_id", jsonData.data._id);
    pm.environment.set("booking_code", jsonData.data.bookingCode);
}
```

✅ **Dùng biến trong requests:**
- Đặt trong URL: `{{base_url}}/services/{{service_id}}`
- Đặt trong Body: `"serviceId": "{{service_id}}"`

✅ **Kiểm tra lỗi validation:**
- Thử gửi request thiếu field bắt buộc
- Xem error message

---

## 8️⃣ TROUBLESHOOTING

### ❌ "Cannot GET /api/v1/admin/services"
→ Server chưa chạy hoặc route chưa được thêm vào `index.route.ts`

### ❌ "Cast to ObjectId failed"
→ ID không hợp lệ hoặc chưa được tạo

### ❌ "Validation error"
→ Kiểm tra lại body request, có thể thiếu field bắt buộc

### ❌ "500 Internal Server Error"
→ Kiểm tra logs trong terminal

---

## 9️⃣ FILE POSTMAN COLLECTION

File `Postman_Collection.json` đã có trong folder project.
Import bằng: **File** → **Import** → Chọn file

Enjoy! 🚀
