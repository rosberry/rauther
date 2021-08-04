# Default full example

## Description

This example...

## Requests

### Get Auth Bearer token

POST `/auth`

```json
{
  "device_id": "123-321-1"
}
```

**Response:**

```json
{
  "device_id": "123-321-1",
  "result": true,
  "token": "f14157df-fded-4ede-9ce9-34ba69c41a76"
}
```

### SignUp request

POST `/sign-up`

```json
{
  "email": "t12@email.com",
  "password": "123456",
  "type": "email"
}
```

**Response:**

```json
{
  "pid": "t12@email.com",
  "result": true
}
```

### Email confirm request

GET `/confirm?pid={pid}&code={code}`

**Response:**

```json
{
  "result": true
}
```

### Request resend confirm code

GET `/confirm/resend`

**Response:**

```json
{
  "result": true
}
```

### SignIn request

POST `/sign-in`

```json
{
  "email": "t12@email.com",
  "password": "123456",
  "type": "email"
}
```

**Response:**

```json
{
  "result": true
}
```

### Request recovery code

POST `/recovery/request`

```json
{
  "pid": "t12@email.com",
  "type": "email"
}
```

**Response:**

```json
{
  "result": true
}
```

### Recovery password request

POST `/recovery`

```json
{
  "pid": "t12@email.com",
  "code": "eba206bd-e5e3-4da3-8c2e-f770ac0669c8",
  "password": "321"
}
```

**Response:**

```json
{
  "result": true
}
```
