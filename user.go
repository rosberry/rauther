package rauther

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

// type ConfirmableUser interface{}
// ..etc
