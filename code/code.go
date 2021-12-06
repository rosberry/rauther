package code

import (
	"crypto/rand"

	"github.com/google/uuid"
)

type Generator func(length int) string

// UUID code
// length not used
func UUID(length int) (code string) {
	return uuid.NewString()
}

// String code
// from charset: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
func String(length int) string {
	return stringWithCharset(length, charset)
}

// Numeric code
func Numeric(length int) string {
	return stringWithCharset(length, charsetNum)
}

const charset = "abcdefghijklmnopqrstuvwxyz" +
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const charsetNum = "0123456789"

func stringWithCharset(length int, charset string) string {
	b := make([]byte, length)
	rand.Read(b) // nolint

	for i := 0; i < len(b); i++ {
		b[i] = charset[int(b[i])%len(charset)]
	}

	return string(b)
}
