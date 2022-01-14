package user

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/rosberry/auth"
)

type SocialDetails *auth.UserDetails

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

type SocialAuthableUser interface {
	AuthableUser
	SetUserDetails(authType string, userDetails SocialDetails)
}

type confirmedStatus interface {
	AuthableUser
	GetConfirmed(authType string) (ok bool)
	SetConfirmed(authType string, ok bool)
}

type ConfirmableUser interface {
	confirmedStatus
	Confirmed() (ok bool)
	GetConfirmCode(authType string) (code string)
	SetConfirmCode(authType, code string)
}

type RecoverableUser interface {
	AuthableUser
	GetRecoveryCode(authType string) (code string)
	SetRecoveryCode(authType, code string)
}

// interface for checking the interval during which confirmation codes cannot be sent
type CodeSentTimeUser interface {
	AuthableUser
	GetCodeSentTime(authType string) *time.Time
	SetCodeSentTime(authType string, t *time.Time)
}

type OTPAuth interface {
	confirmedStatus
	GetOTP(authType string) (code string)
	SetOTP(authType string, code string) error
}

type TempUser interface {
	confirmedStatus
	IsTemp() bool
	SetTemp(temp bool)
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
	if value != nil {
		fieldVal.Set(reflect.ValueOf(value))
	}

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
