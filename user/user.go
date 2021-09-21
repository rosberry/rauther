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
	GetUID(authType string) (uid string)
	SetUID(authType, uid string)
}

type GuestUser interface {
	IsGuest() bool
	SetGuest(guest bool)
}

type AuthableUser interface {
	User

	GetPassword() (password string)
	SetPassword(password string)
}

type ConfirmableUser interface {
	User

	Confirmed() (ok bool)
	GetConfirmed(authType string) (ok bool)
	GetConfirmCode(authType string) (code string)

	SetConfirmed(authType string, ok bool)
	SetConfirmCode(authType, code string)
}

type RecoverableUser interface {
	User

	GetRecoveryCode() (code string)
	SetRecoveryCode(code string)
}

// interface for checking the interval during which confirmation codes cannot be sent
type ConfirmationSentTimeUser interface {
	User

	GetConfirmationCodeSentTime(authType string) *time.Time
	SetConfirmationCodeSentTime(authType string, t *time.Time)
}

var errObjecNotPointer = errors.New("cannot assign to the item passed, item must be a pointer in order to assign")

const notFoundFieldErrText = "field %s does not exist within the provided item"

func SetFields(obj interface{}, key string, value interface{}) error {
	v := reflect.ValueOf(obj).Elem()
	if !v.CanAddr() {
		return errObjecNotPointer
	}

	findAuthName := func(t reflect.StructTag) string {
		if jt, ok := t.Lookup("auth"); ok {
			return strings.Split(jt, ",")[0]
		}

		return ""
	}

	fieldNames := map[string]int{}

	for i := 0; i < v.NumField(); i++ {
		typeField := v.Type().Field(i)
		tag := typeField.Tag
		jname := findAuthName(tag)
		fieldNames[jname] = i
	}

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

	findAuthName := func(t reflect.StructTag) string {
		if jt, ok := t.Lookup("auth"); ok {
			return strings.Split(jt, ",")[0]
		}

		return ""
	}

	fieldNames := map[string]int{}

	for i := 0; i < v.NumField(); i++ {
		typeField := v.Type().Field(i)
		tag := typeField.Tag
		jname := findAuthName(tag)
		fieldNames[jname] = i
	}

	fieldNum, ok := fieldNames[key]
	if !ok {
		return nil, fmt.Errorf(notFoundFieldErrText, key) // nolint:goerr113
	}

	fieldVal := v.Field(fieldNum)

	return fieldVal.Interface(), nil
}
