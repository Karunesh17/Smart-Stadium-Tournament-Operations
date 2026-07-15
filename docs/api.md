# API Reference Manual - Smart Stadium Gateway

This document lists the primary endpoint specifications exposed by the FastAPI API Gateway.

---

## 🔐 Authentication Router (`/api/v1/auth`)

### 1. User Registration
- **Endpoint:** `POST /api/v1/auth/register`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "Jane Doe",
    "role": "fan"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 1,
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "fan"
  }
  ```

### 2. User Login (Session Cookie Creation)
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):** Sets JWT cookie in the header.
  ```json
  {
    "message": "Login successful",
    "role": "fan"
  }
  ```

---

## 🍔 Concessions & Inventory API (`/api/v1`)

### 1. Retrieve Items Catalog
- **Endpoint:** `GET /api/v1/items`
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Hot Dog",
      "stock": 45,
      "price": 8.00,
      "base_price": 8.00,
      "surge_multiplier": 1.0
    }
  ]
  ```

### 2. Concession Stand Checkout (Transaction)
- **Endpoint:** `POST /api/v1/checkout`
- **Request Body:**
  ```json
  {
    "item_id": 1,
    "quantity": 2
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": 10,
    "item_id": 1,
    "quantity": 2,
    "price_at_sale": 8.00
  }
  ```

---

## 🤖 AI Stadium Copilot (`/api/v1/chat`)

### 1. Ask Assistant
- **Endpoint:** `POST /api/v1/chat/`
- **Request Body:**
  ```json
  {
    "message": "What is the vendor refund policy?"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "answer": "Vendors may refund items within 15 minutes of checkout...",
    "confidence_score": 0.95,
    "reasoning": "Matches Vendor Refund Policy document exactly."
  }
  ```

---

## 🏥 Health Check (`/health`)

- **Endpoint:** `GET /health`
- **Response (200 OK):**
  ```json
  {
    "status": "healthy",
    "timestamp": 1784115408,
    "services": {
      "gateway": "up"
    }
  }
  ```
