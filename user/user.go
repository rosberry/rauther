package user

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

type EmailableUser interface {
	User

	GetEmail() (email string)
	SetEmail(email string)
}

type ConfirmableUser interface {
	EmailableUser

	GetConfirmed() (ok bool)
	GetConfirmCode() (code string)

	SetConfirmed(ok bool)
	SetConfirmCode(code string)
}

type RecoverableUser interface {
	EmailableUser

	GetRecoveryCode() (code string)

	SetRecoveryCode(code string)
}
