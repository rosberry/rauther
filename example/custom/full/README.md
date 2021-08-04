# Custom example

## Description

This example...

## Requests

### Get Auth Bearer token

POST `/token`

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

POST `/registration`

Headers: "authtype": "phone"

```json
{
  "phone": "+79009009009",
  "password": "123456",
  "username": "User1",
  "firstName": "Ivan",
  "lastName": "Petrov",
  "age": 30,
  "gender": "male"
}
```

**Response:**

```json
{
  "pid": "User1",
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

POST `/login`

Headers: "authtype": "phone"

```json
{
  "username": "User1",
  "password": "123456"
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

Headers: "authtype": "phone"

```json
{
  "pid": "User1"
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
  "pid": "User1",
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
