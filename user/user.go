package user

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"
)

// Definition of user interfaces

type User interface {
	GetID() (id interface{})
}

type GuestUser interface {
	User
	IsGuest() bool
	SetGuest(guest bool)
}

type AuthableUser interface {
	User
	GetUID(authType string) (uid string)
	SetUID(authType, uid string)
}

type PasswordAuthableUser interface {
	AuthableUser
	GetPassword(authType string) (password string)
	SetPassword(authType, password string)
}

type ConfirmableUser interface {
	AuthableUser
	Confirmed() (ok bool)
	GetConfirmed(authType string) (ok bool)
	GetConfirmCode(authType string) (code string)
	SetConfirmed(authType string, ok bool)
	SetConfirmCode(authType, code string)
}

type RecoverableUser interface {
	AuthableUser
	GetRecoveryCode() (code string)
	SetRecoveryCode(code string)
}

// interface for checking the interval during which confirmation codes cannot be sent
type CodeSentTimeUser interface {
	AuthableUser
	GetCodeSentTime(authType string) *time.Time
	SetCodeSentTime(authType string, t *time.Time)
}

type OTPAuth interface {
	AuthableUser
	GetOTP(authType string) (code string, expiredIn time.Time)
	SetOTP(authType string, code string, expiredIn *time.Time) error
}

type OTPAuthCustomCodeGenerator interface {
	OTPAuth
	GenerateCode() string
}

var errObjecNotPointer = errors.New("cannot assign to the item passed, item must be a pointer in order to assign")

const notFoundFieldErrText = "field %s does not exist within the provided item"

func SetFields(obj interface{}, key string, value interface{}) error {
	v := reflect.ValueOf(obj).Elem()
	if !v.CanAddr() {
		return errObjecNotPointer
	}

	fieldNames := getFieldNames(v)

	fieldNum, ok := fieldNames[key]
	if !ok {
		return fmt.Errorf(notFoundFieldErrText, key) // nolint:goerr113
	}

	fieldVal := v.Field(fieldNum)
	fieldVal.Set(reflect.ValueOf(value))

	return nil
}

func GetField(obj interface{}, key string) (value interface{}, err error) {
	v := reflect.ValueOf(obj).Elem()
	if !v.CanAddr() {
		return nil, errObjecNotPointer
	}

	fieldNames := getFieldNames(v)

	fieldNum, ok := fieldNames[key]
	if !ok {
		return nil, fmt.Errorf(notFoundFieldErrText, key) // nolint:goerr113
	}

	fieldVal := v.Field(fieldNum)

	return fieldVal.Interface(), nil
}

func findAuthName(t reflect.StructTag) string {
	if jt, ok := t.Lookup("auth"); ok {
		return strings.Split(jt, ",")[0]
	}

	return ""
}

func getFieldNames(v reflect.Value) map[string]int {
	fieldNames := map[string]int{}

	for i := 0; i < v.NumField(); i++ {
		typeField := v.Type().Field(i)
		tag := typeField.Tag
		jname := findAuthName(tag)
		fieldNames[jname] = i
	}

	return fieldNames
}
