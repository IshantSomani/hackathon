
# 🏨 Hotel API Endpoints

---

## 🔹 Seed Hotels Data

### Inserts base hotel data with random rooms, vacancy & rating

```
GET /hotel/seed-base
```

**Usage**

```html
<a href="/hotel/seed-base">Seed Hotels Base Data</a>
```

---

## 🔹 Start Auto Vacancy Update

### Updates vacancy of all hotels every 30 seconds (one-time trigger)

```
PUT /hotel/update-vacancy
```

**Usage (HTML note)**
⚠️ `PUT` cannot be triggered directly via `<a>` tag
Use fetch / Postman instead.

```html
<button onclick="startVacancyUpdate()">Start Vacancy Auto Update</button>

<script>
  function startVacancyUpdate() {
    fetch('/hotel/update-vacancy', { method: 'PUT' })
      .then(res => res.json())
      .then(data => console.log(data));
  }
</script>
```

---

## 🔹 List Hotels (with Filters, Sort & Pagination)

### Returns table-ready hotel data

```
GET /hotel/list
```

---

## 📌 Filtering Endpoints

### 🏙️ By City

```
/hotel/list?city=Delhi
```

### 🏨 By Category

```
/hotel/list?category=Luxury
```

### ⭐ Rating Range

```
/hotel/list?minRating=3&maxRating=5
```

### 🏨 Vacancy Range

```
/hotel/list?minVacancy=10&maxVacancy=50
```

### 🔎 Search by Name

```
/hotel/list?name=grand
```

### 📍 Nearby Place

```
/hotel/list?nearbyPlace=Airport
```

---

## 📊 Sorting

### Sort by Rating (Descending)

```
/hotel/list?sortBy=Rating&order=desc
```

### Sort by Vacancy (Ascending)

```
/hotel/list?sortBy=vacancy&order=asc
```

---

## 📄 Pagination

### Page 1 (20 results)

```
/hotel/list?page=1&limit=20
```

### Page 2 (10 results per page)

```
/hotel/list?page=2&limit=10
```

---

## 🔥 Combined Example (Real Use Case)

```
/hotel/list?city=Mumbai&category=Budget&minRating=3&nearbyPlace=Station&sortBy=Rating&order=desc&page=1&limit=10
```

---


## ✅ Summary of Endpoints

| Method | Endpoint                | Description                  |
| ------ | ----------------------- | ---------------------------- |
| GET    | `/hotel/seed-base`      | Seed hotels with random data |
| PUT    | `/hotel/update-vacancy` | Start auto vacancy updater   |
| GET    | `/hotel/list`           | List hotels with filters     |

---
