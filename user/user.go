package user

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
)

// Definition of user interfaces

type User interface {
	GetPID() (pid string)
	SetPID(pid string)
}

type AuthableUser interface {
	User

	GetPassword() (password string)
	SetPassword(password string)
}

/*
type EmailableUser interface {
	User

	GetEmail() (email string)
	SetEmail(email string)
}
*/

type ConfirmableUser interface {
	WithExpandableFieldsUser

	GetConfirmed() (ok bool)
	GetConfirmCode() (code string)

	SetConfirmed(ok bool)
	SetConfirmCode(code string)
}

type RecoverableUser interface {
	WithExpandableFieldsUser

	GetRecoveryCode() (code string)
	SetRecoveryCode(code string)
}

// WithExpandableFieldsUser can set/get some field in user model by tag `auth:"key"`
type WithExpandableFieldsUser interface {
	User

	GetField(key string) (value interface{}, err error)
	SetField(key string, value interface{}) error
}

var errObjecNotPointer = errors.New("cannot assign to the item passed, item must be a pointer in order to assign")

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
		return fmt.Errorf("field %s does not exist within the provided item", key)
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
		return nil, fmt.Errorf("field %s does not exist within the provided item", key)
	}

	fieldVal := v.Field(fieldNum)

	return fieldVal.Interface(), nil
}
