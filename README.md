
---

## 📌 Base Endpoint

```
/hotel/list
```

---

## 🏙️ Filter by City

```
/hotel/list?city=Delhi
```

---

## 🏨 Filter by Category

```
/hotel/list?category=Luxury
```

---

## ⭐ Filter by Rating Range

```
/hotel/list?minRating=3&maxRating=5
```

---

## 🏨 Filter by Vacancy Range

```
/hotel/list?minVacancy=10&maxVacancy=50
```

---

## 🔎 Search by Hotel Name

```
/hotel/list?name=grand
```

---

## 📍 Filter by Nearby Place

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

## 🔥 Combined Example

```
/hotel/list?city=Mumbai&category=Budget&minRating=3&nearbyPlace=Station&sortBy=Rating&order=desc&page=1&limit=10
```